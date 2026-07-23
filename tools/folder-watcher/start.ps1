# TaxOrder Pro — Folder Watcher (PowerShell starter)
# Uruchom: .\start.ps1          (polling)
# Uruchom: .\start.ps1 --watch  (FSEvents/inotify)
# Uruchom: .\start.ps1 --scan   (jedno skanowanie i wyjście)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host " ============================================" -ForegroundColor Cyan
Write-Host "  TaxOrder Pro | Folder Watcher Agent" -ForegroundColor Cyan
Write-Host " ============================================" -ForegroundColor Cyan
Write-Host ""

# Znajdź Node.js
$NodePaths = @(
    "C:\Users\acichocki\node\node-v24.16.0-win-x64\node.exe",
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:APPDATA\nvm\current\node.exe"
)
$NodeExe = $null
foreach ($p in $NodePaths) {
    if (Test-Path $p) { $NodeExe = $p; break }
}
if (-not $NodeExe) {
    try { $NodeExe = (Get-Command node -ErrorAction Stop).Source } catch {}
}
if (-not $NodeExe) {
    Write-Host "[!] Nie znaleziono Node.js!" -ForegroundColor Red
    Write-Host "    Zainstaluj z: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "[i] Node.js: $NodeExe" -ForegroundColor Green

# Sprawdź config.json
$ConfigPath = Join-Path $PSScriptRoot "config.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "[!] Brak config.json" -ForegroundColor Red
    Write-Host "    Skopiuj config.example.json -> config.json i uzupelnij." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    Token pobierz w przegladarce (F12 -> Console):" -ForegroundColor Cyan
    Write-Host "    localStorage.getItem('cf_token')" -ForegroundColor White
    exit 1
}

$WatcherPath = Join-Path $PSScriptRoot "watcher.js"
Write-Host "[i] Uruchamiam: $WatcherPath" -ForegroundColor Green
Write-Host ""

& $NodeExe $WatcherPath $args

Write-Host ""
Write-Host "[i] Watcher zakończył pracę." -ForegroundColor Gray
