@echo off
setlocal
title DriveOS 3.1 Phone Access
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Enable-Phone-Access.ps1"
endlocal
