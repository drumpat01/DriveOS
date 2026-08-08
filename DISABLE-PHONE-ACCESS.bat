@echo off
setlocal
title Disable DriveOS Phone Access
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Disable-Phone-Access.ps1"
endlocal
