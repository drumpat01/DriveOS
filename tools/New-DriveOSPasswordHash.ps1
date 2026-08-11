$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

Import-Module `
    (Join-Path $Root "src\Security\DriveOS.WebAuth.psm1") `
    -Force

$Password = Read-Host `
    "Enter the DriveOS web password" `
    -AsSecureString

$Confirmation = Read-Host `
    "Enter it again" `
    -AsSecureString

$FirstHash = New-DriveOSPasswordHash -Password $Password

if (-not (Test-DriveOSPassword -Password $Confirmation -StoredHash $FirstHash)) {
    throw "Passwords did not match."
}

Write-Host ""
Write-Host "DRIVEOS_PASSWORD_HASH="
Write-Host $FirstHash
