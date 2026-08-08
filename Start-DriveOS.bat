@echo off
cd /d "%~dp0"

if exist ".\DriveOS.exe" (
    start "" ".\DriveOS.exe"
    exit /b 0
)

echo.
echo DriveOS.exe has not been built yet.
echo Run INSTALL-DRIVEOS-APP.bat once.
echo.
pause
