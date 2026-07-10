# TaxOrder Pro - setup lokalnego srodowiska dev
# Nie wymaga uprawnien administratora

$nodeDir = "C:\Users\acichocki\node\node-v24.16.0-win-x64"
$sep = ";"

Write-Host "=== TaxOrder Pro dev setup ===" -ForegroundColor Cyan

# 1. Node.js do PATH uzytkownika
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$nodeDir*") {
    [Environment]::SetEnvironmentVariable("Path", ($nodeDir + $sep + $userPath), "User")
    Write-Host "[OK] Node.js dodany do PATH uzytkownika" -ForegroundColor Green
} else {
    Write-Host "[--] Node.js juz w PATH" -ForegroundColor Gray
}

# Odswiez PATH w biezacej sesji
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$env:Path = $nodeDir + $sep + $machinePath + $sep + $userPath

# 2. Weryfikacja Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = & node --version
    Write-Host "[OK] node $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[!!] node nie znaleziony - sprawdz: $nodeDir" -ForegroundColor Red
}

# 3. GitHub CLI - instalacja przez winget jesli brak
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "[..] Instaluje GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli --silent --accept-package-agreements --accept-source-agreements
    $newMachine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $newUser    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path   = $newMachine + $sep + $newUser
    Write-Host "[OK] GitHub CLI zainstalowany" -ForegroundColor Green
} else {
    $ghVer = & gh --version | Select-Object -First 1
    Write-Host "[OK] $ghVer" -ForegroundColor Green
}

# 4. gh auth
$ghCmd2 = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCmd2) {
    $authOut = & gh auth status 2>&1
    $loggedIn = $authOut | Select-String "Logged in"
    if ($loggedIn) {
        Write-Host "[OK] GitHub CLI zalogowany" -ForegroundColor Green
    } else {
        Write-Host "[..] Logowanie do GitHub (otworzy przegladarke)..." -ForegroundColor Yellow
        & gh auth login --web --git-protocol https
    }
} else {
    Write-Host "[!!] gh niedostepny - uruchom nowy terminal i wykonaj: gh auth login" -ForegroundColor Red
}

# 5. npm install
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    Write-Host "[..] npm install..." -ForegroundColor Yellow
    & npm install --silent
    Write-Host "[OK] Zaleznosci zainstalowane" -ForegroundColor Green
} else {
    Write-Host "[!!] npm niedostepny - uruchom nowy terminal" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Gotowe! ===" -ForegroundColor Cyan
Write-Host "Otworz NOWY terminal i sprawdz: node --version, gh auth status"
