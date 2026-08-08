$ErrorActionPreference = "Stop"

# ============================================================
# DriveOS v0.10 - Hidden normal launcher
#
# Loads local Windows-DPAPI-encrypted secrets, injects them
# only into this PowerShell process, and starts DriveOS.
# ============================================================

$DataDirectory = Join-Path $PSScriptRoot "data"
$SecretFile = Join-Path $DataDirectory "driveos-secrets.json"
$ServerFile = Join-Path $PSScriptRoot "DriveOS-Server.ps1"

function Unprotect-DriveOSSecret {
    param([Parameter(Mandatory=$true)][string]$EncryptedValue)

    $SecureString = ConvertTo-SecureString $EncryptedValue
    $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
}

if (-not (Test-Path $SecretFile)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "DriveOS encrypted secrets have not been set up yet.`n`nRun SETUP-DRIVEOS-SECRETS.bat once, then open DriveOS again.",
        "DriveOS",
        "OK",
        "Warning"
    ) | Out-Null
    exit 2
}

if (-not (Test-Path $ServerFile)) {
    throw "DriveOS-Server.ps1 was not found."
}

$Secrets = Get-Content $SecretFile -Raw | ConvertFrom-Json

try {
    $env:TESSIE_TOKEN = Unprotect-DriveOSSecret $Secrets.TessieToken
    $env:SPOTIFY_CLIENT_ID = Unprotect-DriveOSSecret $Secrets.SpotifyClientId
}
catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "DriveOS could not decrypt its local secret cache.`n`nRun UPDATE-DRIVEOS-SECRETS.bat to rebuild it.",
        "DriveOS",
        "OK",
        "Error"
    ) | Out-Null
    exit 3
}

try {
    & $ServerFile
}
finally {
    Remove-Item Env:TESSIE_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:SPOTIFY_CLIENT_ID -ErrorAction SilentlyContinue
}
