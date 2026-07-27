# backup-companies.ps1 — kopia zapasowa tabel z schema_v44 przed migracja lub wycofaniem
#
# Uzycie:
#   .\tools\db\backup-companies.ps1
#   .\tools\db\backup-companies.ps1 -OutDir "D:\backupy"

param(
  [string]$OutDir = "backups"
)

$ErrorActionPreference = "Stop"
$wrangler = ".\node_modules\.bin\wrangler.cmd"

if (-not (Test-Path $wrangler)) {
  Write-Host "Nie znaleziono wranglera: $wrangler" -ForegroundColor Red
  Write-Host "Uruchom z katalogu projektu." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"

$tables = @("companies", "user_company_access")
$saved  = 0

foreach ($t in $tables) {
  $out = Join-Path $OutDir "$($t)_$stamp.json"
  Write-Host "Zrzucam $t ..." -NoNewline
  try {
    & $wrangler d1 execute taxorder-pro --remote --json --command "SELECT * FROM $t" | Out-File -Encoding utf8 $out
    $size = (Get-Item $out).Length
    if ($size -lt 10) {
      Write-Host " pusto (tabela nie istnieje?)" -ForegroundColor Yellow
      Remove-Item $out
    } else {
      Write-Host " -> $out ($size B)" -ForegroundColor Green
      $saved++
    }
  } catch {
    Write-Host " BLAD: $_" -ForegroundColor Red
  }
}

Write-Host ""
if ($saved -gt 0) {
  Write-Host "Zapisano $saved plikow w $OutDir" -ForegroundColor Green
} else {
  Write-Host "Nic nie zapisano — tabele jeszcze nie istnieja (migracja nieuruchomiona)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Punkt przywracania Time Travel D1 (do 30 dni wstecz):" -ForegroundColor Cyan
& $wrangler d1 time-travel info taxorder-pro
