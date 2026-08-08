$ErrorActionPreference = "Stop"

# ============================================================
# DriveOS v0.9 - One-time secret provisioning
#
# This script expects TESSIE_TOKEN and SPOTIFY_CLIENT_ID to
# already be injected by 1Password via `op run`.
#
# It stores only Windows-DPAPI-encrypted values locally.
# ============================================================

$DataDirectory = Join-Path $PSScriptRoot "data"
$SecretFile = Join-Path $DataDirectory "driveos-secrets.json"

if (-not $env:TESSIE_TOKEN) {
    throw "TESSIE_TOKEN was not injected by 1Password."
}

if (-not $env:SPOTIFY_CLIENT_ID) {
    throw "SPOTIFY_CLIENT_ID was not injected by 1Password."
}

if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}


function Protect-DriveOSPrivateFileAcl {
    param([Parameter(Mandatory=$true)][string]$Path)

    try {
        $UserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
        $SystemSid = New-Object System.Security.Principal.SecurityIdentifier(
            [System.Security.Principal.WellKnownSidType]::LocalSystemSid,
            $null
        )

        $Acl = New-Object System.Security.AccessControl.FileSecurity
        $Acl.SetOwner($UserSid)
        $Acl.SetAccessRuleProtection($true, $false)

        $Inheritance = [System.Security.AccessControl.InheritanceFlags]::None
        $Propagation = [System.Security.AccessControl.PropagationFlags]::None
        $Allow = [System.Security.AccessControl.AccessControlType]::Allow
        $Rights = [System.Security.AccessControl.FileSystemRights]::FullControl

        $Acl.AddAccessRule(
            (New-Object System.Security.AccessControl.FileSystemAccessRule(
                $UserSid,
                $Rights,
                $Inheritance,
                $Propagation,
                $Allow
            ))
        )

        $Acl.AddAccessRule(
            (New-Object System.Security.AccessControl.FileSystemAccessRule(
                $SystemSid,
                $Rights,
                $Inheritance,
                $Propagation,
                $Allow
            ))
        )

        Set-Acl -Path $Path -AclObject $Acl
        return $true
    }
    catch {
        Write-Warning "DriveOS could not tighten the file ACL. DPAPI encryption is still active."
        return $false
    }
}

function Protect-DriveOSSecret {
    param([Parameter(Mandatory=$true)][string]$Value)

    return $Value |
        ConvertTo-SecureString -AsPlainText -Force |
        ConvertFrom-SecureString
}

$Payload = [PSCustomObject]@{
    Version         = 1
    CreatedAt       = (Get-Date).ToString("o")
    WindowsUser     = "$env:USERDOMAIN\$env:USERNAME"
    TessieToken     = Protect-DriveOSSecret $env:TESSIE_TOKEN
    SpotifyClientId = Protect-DriveOSSecret $env:SPOTIFY_CLIENT_ID
}

$Payload |
    ConvertTo-Json |
    Set-Content -Path $SecretFile -Encoding UTF8

$AclHardened = Protect-DriveOSPrivateFileAcl -Path $SecretFile

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "              DRIVE OS SECRETS SAVED                   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DriveOS now has an encrypted local credential cache." -ForegroundColor Green
Write-Host ""
Write-Host "Saved to:" -ForegroundColor DarkGray
Write-Host $SecretFile -ForegroundColor Yellow
Write-Host ""
Write-Host "The Tessie token and Spotify Client ID are NOT stored in plaintext." -ForegroundColor Green
Write-Host "Windows DPAPI ties the encrypted values to this Windows user account." -ForegroundColor Green
if ($AclHardened) { Write-Host "The secret file ACL was also restricted to your account and SYSTEM." -ForegroundColor Green }
Write-Host ""
Write-Host "From now on, launch DriveOS from the desktop icon normally." -ForegroundColor Cyan
Write-Host "You should no longer need to enter your 1Password password at startup." -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
