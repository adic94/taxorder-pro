# TaxOrder Pro — Lokalne środowisko deweloperskie
# Uruchamia Worker lokalnie (D1 lokalne) + frontend na http-server
# Użycie: .\dev.ps1

$NODE_PATH = "C:\Users\acichocki\node\node-v24.16.0-win-x64"
$env:Path = "$NODE_PATH;" + $env:Path
$WRANGLER = ".\node_modules\.bin\wrangler.cmd"

Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    TaxOrder Pro — Środowisko lokalne DEV     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "Adresy:" -ForegroundColor White
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Green
Write-Host "  Worker:    http://localhost:8787" -ForegroundColor Green
Write-Host "  D1:        lokalna kopia (nie dotyka produkcji)`n" -ForegroundColor Yellow

Write-Host "Ctrl+C aby zatrzymać oba procesy.`n" -ForegroundColor Gray

# Uruchom frontend (http-server) w tle
$frontendJob = Start-Job -ScriptBlock {
    param($nodePath, $dir)
    $env:Path = "$nodePath;" + $env:Path
    Set-Location $dir
    & ".\node_modules\.bin\http-server.cmd" . -p 3000 -c-1 --silent
} -ArgumentList $NODE_PATH, $PWD

Write-Host "▶ Frontend uruchomiony (PID zadania: $($frontendJob.Id))" -ForegroundColor Cyan

# Uruchom Worker z wrangler dev (blokujące — główny proces)
Write-Host "▶ Uruchamianie Cloudflare Worker (lokalne D1)..." -ForegroundColor Cyan
Write-Host "  Zmiany w worker/index.js → automatyczny reload`n" -ForegroundColor Gray

try {
    & $WRANGLER dev --local --persist-to .wrangler/state
} finally {
    # Cleanup: zatrzymaj frontend
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "`n🛑 Środowisko lokalne zatrzymane." -ForegroundColor Yellow
}
