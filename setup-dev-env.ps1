# TaxOrder Pro — setup lokalnego srodowiska dev
# Nie wymaga uprawnien administratora

$nodeDir = "C:\Users\acichocki\node\node-v24.16.0-win-x64"
$sep = [System.IO.Path]::PathSeparator

Write-Host "=== TaxOrder Pro dev setup ===" -ForegroundColor Cyan

# 1. Node.js do PATH uzytkownika
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$nodeDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$nodeDir$sep$userPath", "User")
    Write-Host "[OK] Node.js dodany do PATH uzytkownika" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js juz w PATH" -ForegroundColor Gray
}

# Odswiez PATH w biezacej sesji
$env:Path = "$nodeDir$sep" + [Environment]::GetEnvironmentVariable("Path", "Machine") + $sep + $userPath

# 2. Weryfikacja Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "[OK] node $(node --version)" -ForegroundColor Green
} else {
    Write-Host "[!!] node nie znaleziony — sprawdz sciezke: $nodeDir" -ForegroundColor Red
}

# 3. GitHub CLI — instalacja przez winget jesli brak
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[..] Instaluje GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli --silent --accept-package-agreements --accept-source-agreements
    # Odswiez PATH po instalacji
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + $sep + [Environment]::GetEnvironmentVariable("Path", "User")
} else {
    Write-Host "[OK] gh $(gh --version | Select-Object -First 1)" -ForegroundColor Green
}

# 4. gh auth
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $authOk = gh auth status 2>&1 | Select-String "Logged in"
    if ($authOk) {
        Write-Host "[OK] GitHub CLI zalogowany" -ForegroundColor Green
    } else {
        Write-Host "[..] Logowanie do GitHub (otworzy przegladarke)..." -ForegroundColor Yellow
        gh auth login --web --git-protocol https
    }
} else {
    Write-Host "[!!] gh niedostepny po instalacji — uruchom nowy terminal i wykonaj: gh auth login" -ForegroundColor Red
}

# 5. npm install
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "[..] npm install..." -ForegroundColor Yellow
    npm install --silent
    Write-Host "[OK] Zaleznosci zainstalowane" -ForegroundColor Green
} else {
    Write-Host "[!!] npm niedostepny — uruchom nowy terminal" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Gotowe! ===" -ForegroundColor Cyan
Write-Host "Otworz NOWY terminal i sprawdz: node --version, gh auth status"
