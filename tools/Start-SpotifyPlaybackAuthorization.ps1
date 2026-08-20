param(
    [Parameter(Mandatory=$true)][string]$Root
)

$ErrorActionPreference = "Stop"
$Root = [IO.Path]::GetFullPath($Root)
$ProtectionModule = Join-Path $Root "src\Security\DriveOS.SecretProtection.psm1"
$SecretPath = Join-Path $Root "data\driveos-secrets.json"
$ConnectScript = Join-Path $Root "Connect-Spotify.ps1"

Import-Module Microsoft.PowerShell.Security
Import-Module $ProtectionModule -Force
$Secrets = Get-Content -LiteralPath $SecretPath -Raw | ConvertFrom-Json
$env:SPOTIFY_CLIENT_ID = Unprotect-DriveOSSecret -ProtectedText $Secrets.SpotifyClientId -Mode desktop
& $ConnectScript
