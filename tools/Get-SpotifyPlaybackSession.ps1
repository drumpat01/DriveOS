param(
    [Parameter(Mandatory=$true)][string]$Root
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = [IO.Path]::GetFullPath($Root)
$DataDirectory = [IO.Path]::GetFullPath((Join-Path $Root "data"))
$TokenPath = [IO.Path]::GetFullPath((Join-Path $DataDirectory "spotify-token.json"))
$SecretPath = [IO.Path]::GetFullPath((Join-Path $DataDirectory "driveos-secrets.json"))
$ProtectionModule = [IO.Path]::GetFullPath((Join-Path $Root "src\Security\DriveOS.SecretProtection.psm1"))

if (-not $TokenPath.StartsWith($DataDirectory, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Spotify token path is outside the JourneyDeck data directory."
}

Import-Module Microsoft.PowerShell.Security
Import-Module $ProtectionModule -Force

$TokenCache = Get-Content -LiteralPath $TokenPath -Raw | ConvertFrom-Json
$Secrets = Get-Content -LiteralPath $SecretPath -Raw | ConvertFrom-Json
$ClientId = Unprotect-DriveOSSecret -ProtectedText $Secrets.SpotifyClientId -Mode desktop
$AccessToken = Unprotect-DriveOSSecret -ProtectedText $TokenCache.AccessToken -Mode desktop
$RefreshToken = Unprotect-DriveOSSecret -ProtectedText $TokenCache.RefreshToken -Mode desktop
$ExpiresAt = [DateTimeOffset]::Parse("$($TokenCache.ExpiresAt)")
$Scope = "$($TokenCache.Scope)"

if ([DateTimeOffset]::Now -ge $ExpiresAt.AddMinutes(-2)) {
    $Response = Invoke-RestMethod `
        -Uri "https://accounts.spotify.com/api/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{
            client_id = $ClientId
            grant_type = "refresh_token"
            refresh_token = $RefreshToken
        }

    $AccessToken = "$($Response.access_token)"
    if ($Response.refresh_token) { $RefreshToken = "$($Response.refresh_token)" }
    if ($Response.scope) { $Scope = "$($Response.scope)" }
    $ExpiresAt = [DateTimeOffset]::Now.AddSeconds([int]$Response.expires_in)

    $UpdatedCache = [ordered]@{
        AccessToken = Protect-DriveOSSecret -PlainText $AccessToken -Mode desktop
        RefreshToken = Protect-DriveOSSecret -PlainText $RefreshToken -Mode desktop
        ExpiresAt = $ExpiresAt.ToString("o")
        Scope = $Scope
    }

    $Json = $UpdatedCache | ConvertTo-Json
    [IO.File]::WriteAllText($TokenPath, $Json, [Text.UTF8Encoding]::new($false))
}

$RequiredScopes = @(
    "streaming"
    "user-read-email"
    "user-read-private"
    "user-modify-playback-state"
    "user-library-modify"
)
$GrantedScopes = @($Scope -split "\s+" | Where-Object { $_ })
$MissingScopes = @($RequiredScopes | Where-Object { $GrantedScopes -notcontains $_ })

$Payload = [ordered]@{
    accessToken = if ($MissingScopes.Count -eq 0) { $AccessToken } else { $null }
    expiresAt = $ExpiresAt.ToString("o")
    scope = $Scope
    playbackReady = ($MissingScopes.Count -eq 0)
    missingScopes = $MissingScopes
}

[Console]::Out.Write(($Payload | ConvertTo-Json -Compress))
