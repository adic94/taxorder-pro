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

# ── 2. XSS Audit ──────────────────────────────────────────────────────────
if (-not $SkipAudit) {
    Step "XSS Audit (tools/autotest/xss-audit.js)..."
    $audit = & "$NODE_PATH\node.exe" tools/autotest/xss-audit.js 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $audit
        ERR "XSS audit nie przeszedł — popraw błędy przed deplojem. Użyj -SkipAudit aby pominąć (niezalecane)."
    }
    OK "XSS audit czysty"
} else {
    Write-Host "  ⚠️  XSS audit pominięty (-SkipAudit)" -ForegroundColor Yellow
}

# ── 3. Migracja DB (opcjonalna) ────────────────────────────────────────────
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

# ── 5. Weryfikacja produkcji ───────────────────────────────────────────────
Step "Weryfikacja produkcji..."
try {
    $resp = Invoke-WebRequest -Uri "$workerUrl/api/auth/me" -Method GET -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 401) {
        OK "Worker odpowiada (401 Unauthorized — poprawnie, brak tokenu)"
    } elseif ($resp.StatusCode -lt 500) {
        OK "Worker odpowiada (HTTP $($resp.StatusCode))"
    } else {
        Write-Host "  ⚠️  Worker odpowiedział HTTP $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Nie udało się zweryfikować: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ── Podsumowanie ───────────────────────────────────────────────────────────
$elapsed = [math]::Round(((Get-Date) - $START).TotalSeconds, 1)
Write-Host "`n╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Deploy zakończony sukcesem ($elapsed s)      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝`n" -ForegroundColor Green
