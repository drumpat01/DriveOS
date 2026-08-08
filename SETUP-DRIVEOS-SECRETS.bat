@echo off
cd /d "%~dp0"

echo.
echo ========================================================
echo              DRIVE OS SECRET SETUP
echo ========================================================
echo.
echo This is a one-time 1Password authentication.
echo After setup, normal DriveOS launches will not use op run.
echo.

op run --env-file=".env" -- powershell -ExecutionPolicy Bypass -File ".\Setup-DriveOS-Secrets.ps1"

if errorlevel 1 (
    echo.
    echo Secret setup failed.
    echo.
    pause
)
