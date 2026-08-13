param(
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$DriveOSFolder = Split-Path -Parent $PSScriptRoot
$IconPath = Join-Path $DriveOSFolder "JourneyDeck.ico"
$AppPath = Join-Path $DriveOSFolder "DriveOS.exe"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "JourneyDeck.lnk"
$LegacyShortcutPath = Join-Path $Desktop "DriveOS.lnk"

if (-not (Test-Path $IconPath)) {
    throw "JourneyDeck.ico was not found in $DriveOSFolder"
}

if (-not (Test-Path $AppPath)) {
    throw "DriveOS.exe has not been built yet. Run INSTALL-DRIVEOS-APP.bat first."
}

if (Test-Path $ShortcutPath) {
    Remove-Item $ShortcutPath -Force
    Start-Sleep -Milliseconds 400
}

if (Test-Path $LegacyShortcutPath) {
    Remove-Item $LegacyShortcutPath -Force
}

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $AppPath
$Shortcut.WorkingDirectory = $DriveOSFolder
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Description = "Open JourneyDeck"
$Shortcut.WindowStyle = 1
$Shortcut.Save()

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ShellRefresh {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(
        int wEventId,
        uint uFlags,
        IntPtr dwItem1,
        IntPtr dwItem2
    );
}
"@

[ShellRefresh]::SHChangeNotify(
    0x08000000,
    0x0000,
    [IntPtr]::Zero,
    [IntPtr]::Zero
)

$Ie4uinit = Join-Path $env:WINDIR "System32\ie4uinit.exe"

if (Test-Path $Ie4uinit) {
    Start-Process `
        $Ie4uinit `
        -ArgumentList "-show" `
        -WindowStyle Hidden `
        -Wait
}

Write-Host ""
Write-Host "JourneyDeck desktop shortcut now points directly to DriveOS.exe." -ForegroundColor Green

if (-not $NoPause) {
    Write-Host ""
    Read-Host "Press Enter to close"
}
