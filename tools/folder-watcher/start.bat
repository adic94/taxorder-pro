@echo off
title TaxOrder Pro — Folder Watcher
color 0A

echo.
echo  ==========================================
echo   TaxOrder Pro ^| Folder Watcher Agent
echo  ==========================================
echo.

:: Szukaj Node.js — najpierw portable, potem PATH
set "NODE="
if exist "C:\Users\acichocki\node\node-v24.16.0-win-x64\node.exe" (
  set "NODE=C:\Users\acichocki\node\node-v24.16.0-win-x64\node.exe"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE=%ProgramFiles%\nodejs\node.exe"
) else (
  where node >nul 2>&1 && set "NODE=node"
)

if "%NODE%"=="" (
  echo [!] Nie znaleziono Node.js!
  echo     Zainstaluj Node.js z https://nodejs.org/
  echo     lub ustaw sciezke w tym pliku.
  pause
  exit /b 1
)

echo [i] Node.js: %NODE%

:: Sprawdź czy config.json istnieje
if not exist "%~dp0config.json" (
  echo [!] Brak pliku config.json
  echo     Skopiuj config.example.json na config.json i uzupelnij dane.
  echo.
  echo     Token pobierz w przegladarce:
  echo     F12 -^> Console -^> localStorage.getItem("cf_token")
  pause
  exit /b 1
)

echo [i] Konfiguracja: %~dp0config.json
echo [i] Uruchamiam watcher (tryb polling)...
echo.

"%NODE%" "%~dp0watcher.js" %*

echo.
echo [i] Watcher zakonczyl prace.
pause
