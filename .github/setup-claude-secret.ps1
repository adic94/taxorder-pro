# Skrypt do jednorazowego ustawienia ANTHROPIC_API_KEY w GitHub Secrets
# Uruchom lokalnie: .\\.github\\setup-claude-secret.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey
)

Write-Host "Ustawiam ANTHROPIC_API_KEY w GitHub Secrets..." -ForegroundColor Cyan

$env:Path = "C:\Users\acichocki\node\node-v24.16.0-win-x64;" + $env:Path

# Ustaw secret przez GitHub CLI
$ApiKey | gh secret set ANTHROPIC_API_KEY --repo adic94/taxorder-pro

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ANTHROPIC_API_KEY ustawiony pomyslnie!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Teraz Claude Code Action jest w pelni aktywny." -ForegroundColor Green
    Write-Host "Uzycie: otwórz Issue na GitHub i dodaj label 'claude'" -ForegroundColor Yellow
} else {
    Write-Host "❌ Blad. Ustaw recznie: https://github.com/adic94/taxorder-pro/settings/secrets/actions" -ForegroundColor Red
}
