# TaxOrder Pro — Deploy all-in-one
# Użycie: .\deploy.ps1 [-SkipAudit] [-Schema vN]
# Przykład: .\deploy.ps1 -Schema v16

param(
    [switch]$SkipAudit,
    [string]$Schema = ""
)

$ErrorActionPreference = 'Stop'
$NODE_PATH = "C:\Users\acichocki\node\node-v24.16.0-win-x64"
$env:Path = "$NODE_PATH;" + $env:Path
$WRANGLER = ".\node_modules\.bin\wrangler.cmd"
$START = Get-Date

function Step($msg) { Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function OK($msg)   { Write-Host "  ✅ $msg" -ForegroundColor Green }
function ERR($msg)  { Write-Host "  ❌ $msg" -ForegroundColor Red; exit 1 }

Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║     TaxOrder Pro — Deploy do Cloudflare      ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Blue

# ── 1. Sprawdzenie Node.js ─────────────────────────────────────────────────
Step "Sprawdzanie Node.js..."
try {
    $nodeVer = & "$NODE_PATH\node.exe" --version 2>&1
    OK "Node.js $nodeVer"
} catch {
    ERR "Node.js nie znaleziony w $NODE_PATH"
}

# ── 2. Syntax check ────────────────────────────────────────────────────────
if (-not $SkipAudit) {
    Step "Syntax check JS (node --check)..."
    $syntax = & "$NODE_PATH\node.exe" tools/autotest/syntax-check.js 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $syntax
        ERR "Błąd składniowy w plikach JS — błąd w worker/index.js = crash całego API!"
    }
    OK "Syntax OK (63 pliki)"

    Step "XSS Audit (tools/autotest/xss-audit.js)..."
    $audit = & "$NODE_PATH\node.exe" tools/autotest/xss-audit.js 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $audit
        ERR "XSS audit nie przeszedł. Użyj -SkipAudit aby pominąć (niezalecane)."
    }
    OK "XSS audit czysty"

    Step "i18n completeness check..."
    $i18n = & "$NODE_PATH\node.exe" tools/autotest/i18n-check.js 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $i18n
        ERR "Brakujące tłumaczenia i18n — dodaj klucze we wszystkich 7 językach."
    }
    OK "i18n kompletne"

    Step "Service Worker cache check..."
    $swCheck = & "$NODE_PATH\node.exe" tools/autotest/sw-cache-bump.js --check 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $swCheck
        Write-Host "  ⚠️  Uruchamiam auto-fix sw.js..." -ForegroundColor Yellow
        & "$NODE_PATH\node.exe" tools/autotest/sw-cache-bump.js 2>&1 | Out-Null
        OK "sw.js zaktualizowany — CACHE_NAME bumped"
    } else {
        OK "sw.js zgodne z index.html"
    }
} else {
    Write-Host "  ⚠️  Wszystkie audyty pominięte (-SkipAudit)" -ForegroundColor Yellow
}

# ── 3. Migration check ─────────────────────────────────────────────────────
Step "Migration check (D1 vs schema_v*.sql)..."
$migCheck = & "$NODE_PATH\node.exe" tools/autotest/migration-check.js 2>&1
if ($LASTEXITCODE -eq 0) {
    OK "D1 w sync z migracjami repo"
} else {
    Write-Host ($migCheck | Select-String '(❌|✅|brak|BRAK|deploy)' | ForEach-Object { "  " + $_.Line })
    Write-Host "  ⚠️  Są niezaaplikowane migracje — pamiętaj o: .\deploy.ps1 -Schema vN" -ForegroundColor Yellow
}

# ── 4. Migracja DB (opcjonalna) ────────────────────────────────────────────
if ($Schema) {
    $schemaFile = "worker/schema_$Schema.sql"
    Step "Migracja DB: $schemaFile..."
    if (-not (Test-Path $schemaFile)) {
        ERR "Plik $schemaFile nie istnieje!"
    }
    $result = & $WRANGLER d1 execute taxorder-pro --remote --file=$schemaFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $result
        ERR "Migracja DB nie powiodła się"
    }
    OK "Migracja $schemaFile wykonana"
}

# ── 4. Deploy Worker ───────────────────────────────────────────────────────
Step "Deploy Cloudflare Worker..."
$deploy = & $WRANGLER deploy 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $deploy
    ERR "Deploy nie powiódł się"
}

# Wyciągnij URL i Version ID z outputu
$workerUrl = ($deploy | Select-String 'https://.*workers\.dev').Matches.Value | Select-Object -First 1
$versionId = ($deploy | Select-String 'Current Version ID:\s*(\S+)').Matches | ForEach-Object { $_.Groups[1].Value } | Select-Object -First 1
OK "Worker wdrożony: $workerUrl"
if ($versionId) { Write-Host "  🔖 Version ID: $versionId" -ForegroundColor Gray }

# ── 5. API Smoke Test (weryfikacja produkcji) ──────────────────────────────
Step "API Smoke Test (produkcja)..."
$smokeEnv = @{}
if ($env:TEST_EMAIL)   { $smokeEnv['TEST_EMAIL']   = $env:TEST_EMAIL }
if ($env:TEST_PASS)    { $smokeEnv['TEST_PASS']    = $env:TEST_PASS }
if ($env:TEST_COMPANY) { $smokeEnv['TEST_COMPANY'] = $env:TEST_COMPANY }
if ($workerUrl)        { $smokeEnv['PROD_WORKER_URL'] = $workerUrl }

$smokeArgs = if ($env:TEST_EMAIL -and $env:TEST_PASS) { '--auth' } else { '' }
$smoke = if ($smokeArgs) {
    & "$NODE_PATH\node.exe" tools/autotest/api-smoke-test.js $smokeArgs 2>&1
} else {
    & "$NODE_PATH\node.exe" tools/autotest/api-smoke-test.js 2>&1
}
Write-Host ($smoke | Select-String '(✅|❌|⏭|Wynik|PASS|FAIL)' | ForEach-Object { "  " + $_.Line })
if ($LASTEXITCODE -ne 0) {
    Write-Host $smoke
    ERR "Smoke test nie przeszedł — produkcja nie działa poprawnie po deploymen!"
}
OK "Smoke test PASSED"

# ── Podsumowanie ───────────────────────────────────────────────────────────
$elapsed = [math]::Round(((Get-Date) - $START).TotalSeconds, 1)
Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Deploy zakończony sukcesem ($elapsed s)      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Green
