# TaxOrder Pro — Instalacja git hooks
# Uruchom raz po sklonowaniu repo: .\tools\install-hooks.ps1

$ErrorActionPreference = 'Stop'

Write-Host "`n🔧 Instalacja git hooks dla TaxOrder Pro..." -ForegroundColor Cyan

# Ustaw hooksPath na śledzony katalog
git config core.hooksPath tools/hooks
if ($?) {
    Write-Host "✅ core.hooksPath ustawiony na tools/hooks" -ForegroundColor Green
} else {
    Write-Host "❌ Błąd ustawiania hooksPath" -ForegroundColor Red
    exit 1
}

Write-Host "`nZainstalowane hooki:"
Write-Host "  pre-commit — automatyczny XSS audit przed każdym git commit"
Write-Host "`nAby odinstalować: git config --unset core.hooksPath"
Write-Host ""
