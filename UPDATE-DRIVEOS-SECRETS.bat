@echo off
cd /d "%~dp0"

echo.
echo ========================================================
echo             UPDATE DRIVE OS SECRETS
echo ========================================================
echo.
echo This refreshes the encrypted DriveOS credential cache
echo from the current values referenced by .env in 1Password.
echo.

op run --env-file=".env" -- powershell -ExecutionPolicy Bypass -File ".\Setup-DriveOS-Secrets.ps1"

if errorlevel 1 (
    echo.
    echo Secret update failed.
    echo.
    pause
)
