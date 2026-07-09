# TaxOrder Pro - Migrator Hogart RTM Lite -> TaxOrder Pro
# Uzycie:
#   .\tools\rtm-migrator\rtm-import.ps1 -SqliteFile "C:\Hogart\Hogart RTM Lite\RTM_Demo.sqlite"
#   .\tools\rtm-migrator\rtm-import.ps1 -SqliteFile "..." -ApiUrl "https://..." -Token "token" -Company "mtoilet"
param(
    [Parameter(Mandatory=$true)][string]$SqliteFile,
    [string]$SqliteDll  = "C:\Hogart\Hogart RTM Lite\System.Data.SQLite.dll",
    [string]$ApiUrl     = "https://taxorder-pro-api.adamus1000.workers.dev",
    [string]$Token      = "",
    [string]$Company    = "",
    [switch]$DryRun,
    [switch]$NoTaxpayer
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step($m) { Write-Host "`n> $m" -ForegroundColor Cyan }
function Write-OK($m)   { Write-Host "  OK: $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  WARN: $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  ERR: $m" -ForegroundColor Red; exit 1 }

Write-Host "`n=== TaxOrder Pro - Migrator RTM Lite ===" -ForegroundColor Blue

Write-Step "Sprawdzanie plikow..."
if (-not (Test-Path $SqliteFile)) { Write-Err "Nie znaleziono SQLite: $SqliteFile" }
if (-not (Test-Path $SqliteDll))  { Write-Err "Nie znaleziono DLL: $SqliteDll" }

[System.Reflection.Assembly]::LoadFile($SqliteDll) | Out-Null
$conn = New-Object System.Data.SQLite.SQLiteConnection("Data Source=$SqliteFile;Version=3;Read Only=True;")
$conn.Open()
Write-OK "Polaczono z: $SqliteFile"

function Query([string]$sql) {
    $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
    $r = $cmd.ExecuteReader()
    $rows = [System.Collections.Generic.List[hashtable]]::new()
    while ($r.Read()) {
        $row = [ordered]@{}
        for ($i = 0; $i -lt $r.FieldCount; $i++) {
            $v = $r.GetValue($i)
            $row[$r.GetName($i)] = if ($v -is [System.DBNull]) { $null } else { $v }
        }
        $rows.Add($row)
    }
    $r.Close(); return $rows
}

Write-Step "Odczyt danych z RTM..."
$assets  = Query "SELECT * FROM RTM_Asset WHERE Activity = 1 ORDER BY AssetCode"
$subject = (Query "SELECT * FROM AppSubject LIMIT 1") | Select-Object -First 1
$muni    = (Query "SELECT * FROM RTM_Municipality LIMIT 1") | Select-Object -First 1

Write-OK "Pojazdy: $($assets.Count)"
if ($subject) { Write-OK "Podatnik: $($subject.PelnaNazwa) (NIP: $($subject.Nip))" }
if ($muni)    { Write-OK "Gmina: $($muni.Name)" }

# Polskie znaki przez [char] - PS5.1 jest case-insensitive, wiec nie mozna miec $a_ i $A_ jednoczesnie
# uzywamy tylko malych liter (duze nie sa potrzebne w nazwach typow pojazdow)
$a_= [char]0x0105; $e_=[char]0x0119; $o_=[char]0x00F3; $z_=[char]0x017C
$l_=[char]0x0142; $s_=[char]0x015B

$VEH_TYPE = @{
    1 = "samoch${o_}d ci${e_}${z_}arowy"
    2 = "ci${a_}gnik siod${l_}owy"
    3 = "ci${a_}gnik balastowy"
    4 = "przyczepa"
    5 = "naczepa"
    6 = "autobus"
}
$SUSPENSION = @{
    1 = "pneumatyczne"
    2 = "mechaniczne"
    3 = "inne"
}
$OWNERSHIP = @{
    1 = "w${l_}a${s_}ciciel"
    2 = "wsp${o_}${l_}w${l_}a${s_}ciciel-1"
    3 = "wsp${o_}${l_}w${l_}a${s_}ciciel-2"
}

function ParseDate([string]$d) {
    if (-not $d) { return $null }
    try {
        $part = $d.Trim().Split(' ')[0]
        $dt = [datetime]::ParseExact($part, 'dd.MM.yyyy', $null)
        return $dt.ToString('yyyy-MM-dd')
    } catch { return $null }
}
function SafeStr([object]$v) { if ($null -eq $v) { return '' } else { return [string]$v } }
function SafeInt([object]$v) { if ($null -eq $v) { return $null } try { return [int]$v } catch { return $null } }
# RTM przechowuje DMC w TONACH. TaxOrder Pro uzywakilogr (kg). Konwersja: tony * 1000 = kg
function DmcKg([object]$v)   { if ($null -eq $v) { return $null } try { return [int]([double]$v * 1000) } catch { return $null } }

function SplitBrandModel([string]$bm) {
    if (-not $bm) { return @{ marka=''; model='' } }
    $parts = $bm.Trim() -split '\s+', 2
    return @{ marka=$parts[0]; model=if ($parts.Length -gt 1) { $parts[1] } else { '' } }
}

Write-Step "Konwersja pojazdow RTM -> TaxOrder Pro..."
$vehicles = @()
foreach ($a in $assets) {
    $bm  = SplitBrandModel (SafeStr $a.BrandModel)
    $dmc = DmcKg $a.Dmc
    $dmcZ= DmcKg $a.DmcZp

    $typCode = SafeInt $a.VehicleType
    $susCode = SafeInt $a.Suspension
    $ownCode = SafeInt $a.OwnershipType
    if (-not $ownCode) { $ownCode = 1 }

    $regNo = (SafeStr $a.RegNo).ToUpper().Trim()
    $veh = [ordered]@{
        nr_rej          = $regNo
        vin             = (SafeStr $a.VinNo).ToUpper().Trim()
        marka           = $bm.marka
        model           = $bm.model
        rok             = SafeInt $a.YearOfProduction
        typ             = if ($VEH_TYPE.ContainsKey($typCode)) { $VEH_TYPE[$typCode] } else { "nieznany" }
        zawieszenie     = if ($SUSPENSION.ContainsKey($susCode)) { $SUSPENSION[$susCode] } else { "inne" }
        dmc             = $dmc
        dmcMax          = $dmc
        dmcZespolu      = $dmcZ
        osie            = if ($null -ne $a.AxlesNo) { [int]$a.AxlesNo } else { 2 }
        miejscaSied     = SafeInt $a.SeatsNo
        dataRejestracji = ParseDate (SafeStr $a.FirstRegDate)
        purchaseDate    = ParseDate (SafeStr $a.PurchaseDate)
        dataNabycia     = ParseDate (SafeStr $a.PurchaseDate)
        dataZbycia      = ParseDate (SafeStr $a.DisposalDate)
        saleDate        = ParseDate (SafeStr $a.DisposalDate)
        dataWycofania   = ParseDate (SafeStr $a.WithdrawalDate)
        dataWyrejestrowania = ParseDate (SafeStr $a.UnregisterDate)
        assetCode       = SafeStr $a.AssetCode
        ownership_type  = if ($OWNERSHIP.ContainsKey($ownCode)) { $OWNERSHIP[$ownCode] } else { "wlasciciel" }
        is_active       = ($a.Activity -eq 1) -and ($null -eq $a.DisposalDate) -and ($null -eq $a.UnregisterDate)
        miesiacePodatku = 12
    }
    $vehicles += $veh
    Write-Host "  -> $regNo | typ=$($veh.typ) | DMC=$($dmc)kg | $($bm.marka) $($bm.model)" -ForegroundColor Gray
}
Write-OK "Skonwertowano $($vehicles.Count) pojazd(ow)"

$taxpayer = $null
if ((-not $NoTaxpayer) -and $subject) {
    $streetParts = @($subject.Ulica, $subject.NrDomu) | Where-Object { $_ -ne $null -and $_ -ne '' }
    $street = $streetParts -join ' '
    $taxpayer = [ordered]@{
        name        = SafeStr $subject.PelnaNazwa
        nip         = (SafeStr $subject.Nip).Replace('-','').Replace(' ','')
        regon       = SafeStr $subject.Regon
        street      = $street
        city        = SafeStr $subject.Miejscowosc
        postcode    = SafeStr $subject.KodPocztowy
        gmina       = SafeStr $subject.Gmina
        kodUrzedu   = SafeStr $subject.KodUrzedu
        phone       = SafeStr $subject.Telefon
        mail        = SafeStr $subject.Mail
        przedstawiciel = SafeStr $subject.Przedstawiciel
    }
    Write-OK "Podatnik: $($taxpayer.name)"
}

$payload = [ordered]@{
    _source   = "Hogart RTM Lite"
    _imported = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    _rtm_file = $SqliteFile
    company_id= if ($Company) { $Company } else { "UZUPELNIJ_company_id" }
    vehicles  = $vehicles
}
if ($taxpayer) { $payload | Add-Member -MemberType NoteProperty -Name "_taxpayer" -Value $taxpayer }

$outDir = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if (-not $outDir) { $outDir = "." }
$outFile = Join-Path $outDir "rtm-import-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

$json = $payload | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($outFile, $json, [System.Text.Encoding]::UTF8)
Write-OK "JSON zapisany: $outFile ($([math]::Round((Get-Item $outFile).Length/1024,1)) KB)"

if ((-not $DryRun) -and $Token -and $Company) {
    Write-Step "Wysylanie do TaxOrder Pro API..."
    $headers = @{ 'Authorization'="Bearer $Token"; 'Content-Type'='application/json' }
    try {
        $resp = Invoke-RestMethod -Uri "$ApiUrl/api/import?company=$Company" -Method POST -Headers $headers -Body $json -TimeoutSec 60
        if ($resp.ok) {
            Write-OK "Import OK. Liczba rekordow:"
            $resp.counts.PSObject.Properties | ForEach-Object { Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor Gray }
        } else { Write-Warn "API error: $($resp | ConvertTo-Json -Compress)" }
    } catch { Write-Warn "Blad API: $_`n  JSON zapisany lokalnie: $outFile" }
} elseif (-not $DryRun -and -not $Token) {
    Write-Host "`nAby importowac dane - wykonaj polecenie:" -ForegroundColor Yellow
    Write-Host "  Invoke-RestMethod -Uri '$ApiUrl/api/import?company=COMPANY_ID' -Method POST -Headers @{'Authorization'='Bearer TOKEN';'Content-Type'='application/json'} -InFile '$outFile'"
}

$conn.Close()
Write-Host "`n=== GOTOWE: $($vehicles.Count) pojazd(ow) ===" -ForegroundColor Green