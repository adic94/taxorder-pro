<#
.SYNOPSIS
    ZSIA → TaxOrder Pro — bridge synchronizacji danych

.DESCRIPTION
    Łączy się z bazą mToilet_Produkcyjna na SRVDRI,
    eksportuje pojazdy i kierowców do JSON zgodnego z TaxOrder Pro,
    opcjonalnie wysyła dane bezpośrednio do API TaxOrder Pro.

.PARAMETER Mode
    export   - zapisz do pliku JSON (domyślne)
    push     - wyślij do TaxOrder Pro API
    both     - zapisz i wyślij

.PARAMETER ApiKey
    Klucz API TaxOrder Pro (tord_live_...) — wymagany dla Mode push/both

.PARAMETER Company
    ID firmy w TaxOrder Pro (domyślnie: mtoilet)

.PARAMETER OutputDir
    Katalog na pliki eksportu (domyślnie: folder skryptu)

.EXAMPLE
    .\zsia-sync.ps1 -Mode export
    .\zsia-sync.ps1 -Mode push -ApiKey "tord_live_XXXX" -Company mtoilet
    .\zsia-sync.ps1 -Mode both  -ApiKey "tord_live_XXXX" -Company gcon
#>

param(
    [ValidateSet('export','push','both')]
    [string]$Mode = 'export',
    [string]$ApiKey = '',
    [string]$Company = 'mtoilet',
    [string]$OutputDir = $PSScriptRoot,
    [string]$Server = 'SRVDRI',
    [string]$Database = 'mToilet_Produkcyjna'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# ──────────────────────────────────────────────────────────────
# Mapowanie KodOddzialu ZSIA → company_id TaxOrder Pro
# Dostosuj do swoich oddziałów!
# ──────────────────────────────────────────────────────────────
$BRANCH_MAP = @{
    'MTL'  = 'mtoilet'
    'GCON' = 'gcon'
    'GR'   = 'grental'
    'KJR'  = 'kjrsupply'
    'NWK'  = 'nwkinvest'
    'WOL'  = 'wolund'
}

function Map-Company($kodOddzialu) {
    if ($BRANCH_MAP.ContainsKey($kodOddzialu)) { return $BRANCH_MAP[$kodOddzialu] }
    return $Company   # fallback: parametr -Company
}

# ──────────────────────────────────────────────────────────────
# Połączenie z SQL Server
# ──────────────────────────────────────────────────────────────
function Get-SqlConnection {
    $connStr = "Data Source=$Server;Initial Catalog=$Database;Integrated Security=True;Encrypt=False;TrustServerCertificate=True;Connection Timeout=15"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    try {
        $conn.Open()
        Write-Host "[OK] Polaczono z $Server/$Database jako $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
        return $conn
    } catch {
        Write-Error "Blad polaczenia z SQL Server: $($_.Exception.Message)"
    }
}

function Invoke-Sql($conn, $sql) {
    $cmd    = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $cmd.CommandTimeout = 60
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $ds = New-Object System.Data.DataSet
    $adapter.Fill($ds) | Out-Null
    return $ds.Tables[0]
}

# ──────────────────────────────────────────────────────────────
# Znajdź tabelę pojazdów (auto-discovery)
# ──────────────────────────────────────────────────────────────
function Find-VehicleTable($conn) {
    $candidates = @('dbo.Samochody','dbo.FSamochody','dbo.Pojazdy','dbo.Flota',
                    'Samochody','Pojazdy','Flota')
    foreach ($tbl in $candidates) {
        try {
            $r = Invoke-Sql $conn "SELECT TOP 1 * FROM $tbl"
            if ($r -ne $null) {
                Write-Host "[OK] Tabela pojazdow: $tbl ($($r.Rows.Count > 0 ? 'dane' : 'pusta'))"
                return $tbl
            }
        } catch { }
    }
    # Szukaj w INFORMATION_SCHEMA po kolumnie NumerRejestracyjny
    $r = Invoke-Sql $conn @"
        SELECT TOP 1 TABLE_SCHEMA+'.'+TABLE_NAME AS TBL
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE COLUMN_NAME IN ('NumerRejestracyjny','NrRejestracyjny','NrRej')
        ORDER BY TABLE_NAME
"@
    if ($r.Rows.Count -gt 0) {
        $tbl = $r.Rows[0]['TBL']
        Write-Host "[OK] Znaleziono tabele pojazdow: $tbl"
        return $tbl
    }
    throw "Nie znaleziono tabeli pojazdow w bazie $Database"
}

function Find-DriverTable($conn) {
    $candidates = @('dbo.KierowcyPracownicyHandlowcy','dbo.Kierowcy','dbo.Pracownicy',
                    'KierowcyPracownicyHandlowcy','Kierowcy')
    foreach ($tbl in $candidates) {
        try {
            $r = Invoke-Sql $conn "SELECT TOP 1 * FROM $tbl"
            Write-Host "[OK] Tabela kierowcow: $tbl"
            return $tbl
        } catch { }
    }
    return $null
}

# ──────────────────────────────────────────────────────────────
# Pomocniki
# ──────────────────────────────────────────────────────────────
function Val($row, [string[]]$cols) {
    foreach ($c in $cols) {
        if ($row.Table.Columns.Contains($c) -and $row[$c] -ne [DBNull]::Value -and "$($row[$c])" -ne '') {
            return "$($row[$c])".Trim()
        }
    }
    return $null
}

function DateVal($row, [string[]]$cols) {
    $v = Val $row $cols
    if (-not $v) { return $null }
    try {
        $d = [datetime]::Parse($v)
        return $d.ToString('yyyy-MM-dd')
    } catch { return $null }
}

function NumVal($row, [string[]]$cols) {
    $v = Val $row $cols
    if (-not $v) { return $null }
    $n = 0
    if ([double]::TryParse($v.Replace(',','.'), [System.Globalization.NumberStyles]::Any,
        [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { return $n }
    return $null
}

# ──────────────────────────────────────────────────────────────
# Eksport pojazdów
# ──────────────────────────────────────────────────────────────
function Export-Vehicles($conn, $tableName) {
    Write-Host "`n[->] Eksportuje pojazdy z $tableName ..."

    # Pobierz wszystkie kolumny z tabeli (nie zakładamy konkretnych nazw)
    $cols = (Invoke-Sql $conn "SELECT TOP 0 * FROM $tableName").Columns | ForEach-Object { $_.ColumnName }
    Write-Host "     Kolumny: $($cols -join ', ')"

    $rows = Invoke-Sql $conn "SELECT * FROM $tableName ORDER BY 1"
    Write-Host "     Rekordow: $($rows.Rows.Count)"

    $vehicles = @()
    foreach ($row in $rows.Rows) {
        $nrRej = Val $row 'NumerRejestracyjny','NrRejestracyjny','NrRej','LicensePlate'
        if (-not $nrRej) { continue }

        $nrRej = $nrRej.ToUpper() -replace '\s',''
        $kodOddzialu = Val $row 'KodOddzialu','KodOddzial','Oddzial'
        $companyId = if ($kodOddzialu) { Map-Company $kodOddzialu } else { $Company }

        $v = [ordered]@{
            nr_rej      = $nrRej
            company_id  = $companyId
            marka       = Val  $row 'Marka'
            model       = Val  $row 'Model'
            rok         = NumVal $row 'RokProdukcji','Rok'
            vin         = Val  $row 'NumerPodwozia','NrPodwozia','VIN','Vin'
            dmcKg       = NumVal $row 'DopuszczalnaMasaCalkowita','DMC','Dmc'
            ladownosc   = NumVal $row 'Ladownosc','LadownoscKg'
            euro        = Val  $row 'EURO','Euro','NormaEuro'
            typ         = Val  $row 'Typ','TypPojazdu'
            przeznaczenie = Val $row 'PrzeznaczenieSamochodu','Przeznaczenie'
            status      = if ((Val $row 'CzyAktywny') -eq '1' -or (Val $row 'CzyAktywny') -eq 'True') { 'AKTYWNY' } else { 'NIEAKTYWNY' }
            przebiegKm  = NumVal $row 'StanLicznika','Przebieg','PrzebiegKm'
            avgFuel     = NumVal $row 'SrednieSpalanie','SrednieSpalanieLit'
            ocEnd       = DateVal $row 'DataUbezpieczeniaOC','DataOC','OcDo'
            acEnd       = DateVal $row 'DataUbezpieczeniaAC','DataAC','AcDo'
            nextInspection = DateVal $row 'DataPrzegladu','DataNastepnegoPrzegladu','PrzegladDo'
            udtNextDate = DateVal $row 'DataUDT','UdtDo','DataNastepnegoUDT'
            tachoNextCalib = DateVal $row 'DataLegalizacjiTachografu','TachoDo','DataTacho'
            hasTacho    = if (Val $row 'DataLegalizacjiTachografu','TachoDo') { $true } else { $false }
            hasUdt      = if (Val $row 'DataUDT','UdtDo') { $true } else { $false }
            uwagi       = Val  $row 'Uwagi','Komentarz'
            odpisVat    = Val  $row 'OdpisVAT','OdpisVat','OdpisatVAT'
            kierowca    = Val  $row 'Kierowca','NazwaKierowcy'
            orlenCard1  = Val  $row 'NrKartyPaliwowejORLEN','NrKarty1','KartaOrlen'
            orlenCard2  = Val  $row 'NrKartyPaliwowejORLEN1','NrKarty2'
            _source     = 'ZSIA'
            _exportedAt = (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss')
        }
        # Usuń null-e (opcjonalne — czyści JSON)
        $vClean = [ordered]@{}
        $v.Keys | Where-Object { $v[$_] -ne $null } | ForEach-Object { $vClean[$_] = $v[$_] }
        $vehicles += $vClean
    }
    Write-Host "     Zmapowano: $($vehicles.Count) pojazdow"
    return $vehicles
}

# ──────────────────────────────────────────────────────────────
# Eksport kierowców
# ──────────────────────────────────────────────────────────────
function Export-Drivers($conn, $tableName) {
    if (-not $tableName) { return @() }
    Write-Host "`n[->] Eksportuje kierowcow z $tableName ..."
    $rows = Invoke-Sql $conn "SELECT * FROM $tableName WHERE CzyKierowca = 1 OR CzyKierowca = '1' ORDER BY Nazwisko, Imie"
    Write-Host "     Rekordow: $($rows.Rows.Count)"

    $drivers = @()
    foreach ($row in $rows.Rows) {
        $name = @((Val $row 'Imie'), (Val $row 'Nazwisko')) | Where-Object { $_ } | Join-String -Separator ' '
        if (-not $name) { continue }
        $d = [ordered]@{
            name            = $name
            company_id      = Map-Company (Val $row 'KodOddzialu','KodOddzial')
            license_no      = Val  $row 'NrPrawaJazdy','NumerPrawaJazdy'
            license_category = Val $row 'PrawoJazdyKategoria','KategoriaPJ'
            license_expiry  = DateVal $row 'PrawoJazdyDataWaznosci','DataWaznosciPJ'
            phone           = Val  $row 'Telefon','Telefon2','TelefonKomorkowy'
            email           = Val  $row 'Email','Email2'
            medical_exam    = DateVal $row 'DataBadaniaLekarskiego','DataBadania'
            psych_exam      = DateVal $row 'DataBadaniaPsychologicznego'
            periodic_training = DateVal $row 'DataSzkoleniaOkresowego'
            vehicle_nr_rej  = Val  $row 'Samochod','NrRejSamochodu'
            _source         = 'ZSIA'
        }
        $dClean = [ordered]@{}
        $d.Keys | Where-Object { $d[$_] -ne $null } | ForEach-Object { $dClean[$_] = $d[$_] }
        $drivers += $dClean
    }
    Write-Host "     Zmapowano: $($drivers.Count) kierowcow"
    return $drivers
}

# ──────────────────────────────────────────────────────────────
# Zapis do pliku JSON
# ──────────────────────────────────────────────────────────────
function Save-Export($payload, $outDir) {
    $date    = Get-Date -Format 'yyyyMMdd_HHmm'
    $outFile = Join-Path $outDir "zsia-export-$date.json"
    $payload | ConvertTo-Json -Depth 10 | Out-File $outFile -Encoding utf8
    Write-Host "`n[OK] Zapisano: $outFile ($([Math]::Round((Get-Item $outFile).Length/1KB,1)) KB)"
    return $outFile
}

# ──────────────────────────────────────────────────────────────
# Wysyłka do TaxOrder Pro API
# ──────────────────────────────────────────────────────────────
function Push-ToApi($payload, $company, $apiKey) {
    if (-not $apiKey) { throw "Brak -ApiKey. Wygeneruj klucz w TaxOrder Pro: Admin → Klucze API" }
    $url  = "https://taxorder-pro-api.adamus1000.workers.dev/api/import?company=$company"
    $body = $payload | ConvertTo-Json -Depth 10
    Write-Host "`n[->] Wysylam do $url ..."
    $resp = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType 'application/json' `
                              -Headers @{ Authorization = "Bearer $apiKey" } -TimeoutSec 30
    if ($resp.ok) {
        Write-Host "[OK] Import zakończony:"
        $resp.counts.PSObject.Properties | ForEach-Object { Write-Host "     $($_.Name): $($_.Value)" }
        if ($resp.skipped -and $resp.skipped.Count) {
            Write-Host "     Pominiete ($($resp.skipped.Count)):"
            $resp.skipped | ForEach-Object { Write-Host "       - $($_.table) $($_.id): $($_.reason)" }
        }
    } else {
        Write-Warning "API odpowiedzialo: $($resp | ConvertTo-Json)"
    }
}

# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────
Write-Host "============================================"
Write-Host "  ZSIA → TaxOrder Pro  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Host "  Tryb: $Mode  |  Firma: $Company"
Write-Host "============================================`n"

$conn = Get-SqlConnection

# Auto-discovery tabel
$vehTable = Find-VehicleTable $conn
$drvTable = Find-DriverTable  $conn

# Eksport danych
$vehicles = Export-Vehicles $conn $vehTable
$drivers  = Export-Drivers  $conn $drvTable

$conn.Close()

# Buduj payload TaxOrder Pro
$payload = [ordered]@{
    exportedAt = (Get-Date -Format 'o')
    source     = 'ZSIA'
    company_id = $Company
    vehicles   = $vehicles
    drivers    = $drivers
}

Write-Host "`n[i] Podsumowanie:"
Write-Host "    Pojazdy:  $($vehicles.Count)"
Write-Host "    Kierowcy: $($drivers.Count)"

# Zapis/wysyłka wg Mode
$outFile = $null
if ($Mode -in 'export','both') { $outFile = Save-Export $payload $OutputDir }
if ($Mode -in 'push','both')   { Push-ToApi $payload $Company $ApiKey }

if ($outFile) {
    Write-Host "`n[i] Aby zaimportowac recznie:"
    Write-Host "    1. Otwórz TaxOrder Pro → Import/Eksport"
    Write-Host "    2. Przeciagnij plik: $outFile"
    Write-Host "    3. Wybierz 'Format ZSIA' i kliknij Importuj"
}

Write-Host "`n[DONE]"
