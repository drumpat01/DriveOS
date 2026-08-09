param(
    [int]$ParentPid = 0,
    [Int64]$ParentStartTicks = 0
)

$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Sqlite.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Repositories\DriveOS.Repository.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Tessie\DriveOS.Tessie.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\LastFm\DriveOS.LastFm.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Foursquare\DriveOS.Foursquare.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Vehicle\DriveOS.Vehicle.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Replay\DriveOS.Replay.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Places\DriveOS.Places.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Charging\DriveOS.Charging.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Analytics\DriveOS.Analytics.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Drives\DriveOS.Drives.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Recaps\DriveOS.Recaps.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.Playlists.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.PlaceEnrichment.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Http\DriveOS.Http.psm1") -Force

# ============================================================
# DriveOS 3.2
# Windows PowerShell 5.1 compatible
#
# DriveOS.exe -> authenticated localhost backend -> Tessie / Spotify / Last.fm
# Secrets are never exposed to the browser.
# ============================================================

$HostAddress = "127.0.0.1"
$Port = 8787
$ExpectedHostHeader = "${HostAddress}:$Port"
$TailscaleHostPattern = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)+\.ts\.net(?::443)?$"
$MaxRequestLineBytes = 8192
$MaxHeaderBytes = 32768
$MaxBodyBytes = 65536
$SessionToken = $env:DRIVEOS_SESSION_TOKEN
$ServerLogFile = Join-Path $PSScriptRoot "data\driveos-server.log"

$WebRoot = Join-Path $PSScriptRoot "web"
$DataDirectory = Join-Path $PSScriptRoot "data"
$SpotifyTokenFile = Join-Path $DataDirectory "spotify-token.json"
$SpotifyHistoryFile = Join-Path $DataDirectory "spotify-history.jsonl"
$LastFmConfigFile = Join-Path $DataDirectory "lastfm-config.json"
$LastFmSyncStateFile = Join-Path $DataDirectory "lastfm-sync.json"
$PlaceAliasesFile = Join-Path $DataDirectory "place-aliases.json"
$FoursquareConfigFile = Join-Path $DataDirectory "foursquare-config.json"
$FoursquareCacheFile = Join-Path $DataDirectory "foursquare-place-cache.json"
$FoursquareUsageFile = Join-Path $DataDirectory "foursquare-usage.json"
$ChargingSettingsFile = Join-Path $DataDirectory "charging-settings.json"
$FoursquareDailyLimit = 10
$FoursquareMonthlyLimit = 250
$script:FoursquareApiKeyForRedaction = $null
$Repository = New-DriveOSRepository -DataDirectory $DataDirectory -AppRoot $PSScriptRoot

if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

if (-not $env:TESSIE_TOKEN) {
    throw "TESSIE_TOKEN is not available to DriveOS."
}

if (-not $env:SPOTIFY_CLIENT_ID) {
    throw "SPOTIFY_CLIENT_ID is not available to DriveOS."
}

if ($ParentPid -le 0 -or $ParentStartTicks -le 0) {
    throw "DriveOS server requires a validated desktop parent process."
}

if (-not $SessionToken -or $SessionToken -notmatch "^[0-9a-f]{64}$") {
    throw "DriveOS local-session credential is missing or invalid."
}

function Write-DriveOSServerLog {
    param([string]$Message)

    try {
        $SafeMessage = "$Message"

        foreach ($Secret in @(
            $env:TESSIE_TOKEN,
            $env:SPOTIFY_CLIENT_ID,
            $SessionToken,
            $script:FoursquareApiKeyForRedaction
        )) {
            if ($Secret) {
                $SafeMessage = $SafeMessage.Replace($Secret, "[REDACTED]")
            }
        }

        # Network exceptions can contain the full Last.fm request URI.
        $SafeMessage = $SafeMessage -replace '(?i)(api_key=)[^&\s]+', '$1[REDACTED]'

        $Stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        "$Stamp  $SafeMessage" | Add-Content -Path $ServerLogFile -Encoding UTF8
    }
    catch {}
}

function Test-FixedTimeStringEquals {
    param(
        [string]$Left,
        [string]$Right
    )

    if ($null -eq $Left -or $null -eq $Right) {
        return $false
    }

    $A = [System.Text.Encoding]::UTF8.GetBytes($Left)
    $B = [System.Text.Encoding]::UTF8.GetBytes($Right)

    $Difference = $A.Length -bxor $B.Length
    $Max = [Math]::Max($A.Length, $B.Length)

    for ($i = 0; $i -lt $Max; $i++) {
        $Av = if ($i -lt $A.Length) { $A[$i] } else { 0 }
        $Bv = if ($i -lt $B.Length) { $B[$i] } else { 0 }
        $Difference = $Difference -bor ($Av -bxor $Bv)
    }

    return $Difference -eq 0
}

# ------------------------------------------------------------
# HTTP helpers
# ------------------------------------------------------------

function ConvertTo-JsonSafe {
    param($Object)
    return ($Object | ConvertTo-Json -Depth 20 -Compress)
}

function Send-HttpResponse {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode = 200,
        [string]$StatusText = "OK",
        [string]$ContentType = "application/json; charset=utf-8",
        [byte[]]$Body = @()
    )

    $Header =
        "HTTP/1.1 $StatusCode $StatusText`r`n" +
        "Content-Type: $ContentType`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Cache-Control: no-store`r`n" +
        "Connection: close`r`n" +
        "X-Content-Type-Options: nosniff`r`n" +
        "X-Frame-Options: DENY`r`n" +
        "Referrer-Policy: no-referrer`r`n" +
        "Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()`r`n" +
        "Cross-Origin-Opener-Policy: same-origin`r`n" +
        "Cross-Origin-Resource-Policy: same-origin`r`n" +
        "Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' https://unpkg.com; connect-src 'self' https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org https://i.scdn.co; font-src 'self' data: https://tiles.openfreemap.org; worker-src 'self' blob:; child-src blob:; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'; manifest-src 'self'`r`n" +
        "`r`n"

    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)

    if ($Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }

    $Stream.Flush()
}

function Send-Json {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        $Object,
        [int]$StatusCode = 200,
        [string]$StatusText = "OK"
    )

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonSafe $Object))
    Send-HttpResponse -Stream $Stream -StatusCode $StatusCode -StatusText $StatusText -ContentType "application/json; charset=utf-8" -Body $Bytes
}

function Send-Text {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$Text,
        [string]$ContentType = "text/plain; charset=utf-8",
        [int]$StatusCode = 200,
        [string]$StatusText = "OK"
    )

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    Send-HttpResponse -Stream $Stream -StatusCode $StatusCode -StatusText $StatusText -ContentType $ContentType -Body $Bytes
}

function Get-MimeType {
    param([string]$Path)

    switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".webmanifest" { return "application/manifest+json; charset=utf-8" }
        ".svg"  { return "image/svg+xml" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".ico"  { return "image/x-icon" }
        default { return "application/octet-stream" }
    }
}

# ------------------------------------------------------------
# Spotify token handling
# ------------------------------------------------------------

function Unprotect-Token {
    param([string]$EncryptedToken)

    if (-not $EncryptedToken) { return $null }

    $SecureString = ConvertTo-SecureString $EncryptedToken
    $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
}

function Protect-Token {
    param([string]$Token)

    return $Token |
        ConvertTo-SecureString -AsPlainText -Force |
        ConvertFrom-SecureString
}

function Save-SpotifyTokenCache {
    param(
        [string]$AccessToken,
        [string]$RefreshToken,
        [int]$ExpiresIn,
        [string]$Scope
    )

    $TokenCache = [PSCustomObject]@{
        AccessToken  = Protect-Token $AccessToken
        RefreshToken = Protect-Token $RefreshToken
        ExpiresAt    = (Get-Date).AddSeconds($ExpiresIn).ToString("o")
        Scope        = $Scope
    }
    Write-DriveOSJson -Path $SpotifyTokenFile -Value $TokenCache
}

function Get-SpotifyTokenCache {
    if (-not (Test-Path $SpotifyTokenFile)) {
        throw "Spotify token file not found. Run Connect-Spotify.ps1."
    }

    return Read-DriveOSJson -Path $SpotifyTokenFile
}

function Test-SpotifyScope {
    param([string]$Scope)

    $Cache = Get-SpotifyTokenCache
    $Scopes = @("$($Cache.Scope)" -split "\s+" | Where-Object { $_ })

    return $Scopes -contains $Scope
}

function Get-SpotifyAccessToken {
    $Cache = Get-SpotifyTokenCache

    $AccessToken = Unprotect-Token $Cache.AccessToken
    $RefreshToken = Unprotect-Token $Cache.RefreshToken

    if (-not $RefreshToken) {
        throw "Spotify refresh token is missing. Run Connect-Spotify.ps1 again."
    }

    $ExpiresAt = [DateTimeOffset]::Parse($Cache.ExpiresAt)

    if ([DateTimeOffset]::Now -lt $ExpiresAt.AddMinutes(-2)) {
        return $AccessToken
    }

    $Response = Invoke-RestMethod `
        -Uri "https://accounts.spotify.com/api/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{
            client_id     = $env:SPOTIFY_CLIENT_ID
            grant_type    = "refresh_token"
            refresh_token = $RefreshToken
        }

    if ($Response.refresh_token) {
        $RefreshToken = $Response.refresh_token
    }

    $Scope = $Response.scope
    if (-not $Scope) {
        $Scope = $Cache.Scope
    }

    Save-SpotifyTokenCache `
        -AccessToken $Response.access_token `
        -RefreshToken $RefreshToken `
        -ExpiresIn ([int]$Response.expires_in) `
        -Scope $Scope

    return $Response.access_token
}

function Get-SpotifyRecent {
    param([int]$Limit = 50)

    $Token = Get-SpotifyAccessToken
    $Client = New-SpotifyClient -AccessToken $Token
    return Get-SpotifyRecentlyPlayed -Client $Client -Limit $Limit
}

function Save-SpotifyHistory {
    param($Items)

    if (-not $Items) { return 0 }

    $ExistingIds = @{}

    foreach ($Record in @(Get-DriveOSListeningHistory -Repository $Repository)) {
        if ($Record.id) { $ExistingIds[$Record.id] = $true }
    }

    $NewCount = 0

    foreach ($Item in $Items) {
        $Artists = ($Item.track.artists | ForEach-Object { $_.name }) -join ", "
        $RecordId = "$($Item.track.id)|$($Item.played_at)"

        if (-not $ExistingIds.ContainsKey($RecordId)) {
            $AlbumImage = $null
            $TrackUrl = $null
            $AlbumUrl = $null

            if (
                $Item.track.album.images -and
                $Item.track.album.images.Count -gt 0
            ) {
                # Spotify returns artwork sizes widest-first.
                $AlbumImage = $Item.track.album.images[0].url
            }

            if ($Item.track.external_urls.spotify) {
                $TrackUrl = $Item.track.external_urls.spotify
            }

            if ($Item.track.album.external_urls.spotify) {
                $AlbumUrl = $Item.track.album.external_urls.spotify
            }

            $HistoryRecord = ConvertTo-DriveOSSpotifyPlay -Item $Item
            Add-DriveOSListeningHistoryRecord -Repository $Repository -Record $HistoryRecord

            $ExistingIds[$RecordId] = $true
            $NewCount++
        }
    }

    return $NewCount
}

function Get-SpotifyHistory {
    $Records = @()

    foreach ($Record in @(Get-DriveOSListeningHistory -Repository $Repository)) {
        # v0.2 did not store track_uri, but track_id is sufficient.
        if (-not $Record.track_uri -and $Record.track_id) {
            $Record | Add-Member -NotePropertyName track_uri -NotePropertyValue "spotify:track:$($Record.track_id)" -Force
        }
        $Records += $Record
    }

    return $Records
}



function Get-SpotifyRecordTrackId {
    param($Record)

    if ($Record.track_id) {
        return "$($Record.track_id)"
    }

    # Very old DriveOS records used "trackId|played_at" as the record id.
    if ($Record.id -and "$($Record.id)" -match "^([A-Za-z0-9]{10,64})\|") {
        return $Matches[1]
    }

    return $null
}

function Get-SpotifyTrackMetadata {
    param([string]$TrackId)

    if (-not $TrackId) {
        return $null
    }

    try {
        $Token = Get-SpotifyAccessToken
        $Headers = @{
            Authorization = "Bearer $Token"
        }

        $Track = Invoke-RestMethod `
            -Uri "https://api.spotify.com/v1/tracks/$TrackId" `
            -Headers $Headers `
            -Method Get

        $AlbumImage = $null

        if ($Track.album.images -and $Track.album.images.Count -gt 0) {
            $AlbumImage = $Track.album.images[0].url
        }

        return [PSCustomObject]@{
            albumImage      = $AlbumImage
            spotifyUrl      = $Track.external_urls.spotify
            albumSpotifyUrl = $Track.album.external_urls.spotify
            durationMs      = $Track.duration_ms
        }
    }
    catch {
        return $null
    }
}


function Get-ImageMimeType {
    param([byte[]]$Bytes)

    if (-not $Bytes -or $Bytes.Length -lt 4) {
        return "application/octet-stream"
    }

    if (
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xFF -and
        $Bytes[1] -eq 0xD8 -and
        $Bytes[2] -eq 0xFF
    ) {
        return "image/jpeg"
    }

    if (
        $Bytes.Length -ge 8 -and
        $Bytes[0] -eq 0x89 -and
        $Bytes[1] -eq 0x50 -and
        $Bytes[2] -eq 0x4E -and
        $Bytes[3] -eq 0x47
    ) {
        return "image/png"
    }

    if (
        $Bytes.Length -ge 12 -and
        [Text.Encoding]::ASCII.GetString($Bytes, 0, 4) -eq "RIFF" -and
        [Text.Encoding]::ASCII.GetString($Bytes, 8, 4) -eq "WEBP"
    ) {
        return "image/webp"
    }

    return "application/octet-stream"
}

function Resolve-SpotifyArtworkUrl {
    param([string]$TrackId)

    $History = @(Get-SpotifyHistory)

    foreach ($Record in $History) {
        $RecordTrackId = Get-SpotifyRecordTrackId -Record $Record

        if (
            $RecordTrackId -eq $TrackId -and
            $Record.album_image
        ) {
            return "$($Record.album_image)"
        }
    }

    $Metadata = Get-SpotifyTrackMetadata -TrackId $TrackId

    if ($Metadata -and $Metadata.albumImage) {
        return "$($Metadata.albumImage)"
    }

    return $null
}

function Get-SpotifyArtworkBytes {
    param([string]$TrackId)

    if (-not $TrackId -or $TrackId -notmatch "^[A-Za-z0-9]{10,64}$") {
        throw "Invalid Spotify track ID."
    }

    $ArtworkDirectory = Join-Path $DataDirectory "spotify-artwork"

    if (-not (Test-Path $ArtworkDirectory)) {
        New-Item -ItemType Directory -Path $ArtworkDirectory | Out-Null
    }

    $CachePath = Join-Path $ArtworkDirectory "$TrackId.img"

    if (Test-Path $CachePath -PathType Leaf) {
        $CachedBytes = [IO.File]::ReadAllBytes($CachePath)

        if ($CachedBytes.Length -gt 0) {
            return $CachedBytes
        }
    }

    $ArtworkUrl = Resolve-SpotifyArtworkUrl -TrackId $TrackId

    if (-not $ArtworkUrl) {
        throw "Spotify artwork is unavailable for this track."
    }

    $ArtworkUri = $null

    if (-not [Uri]::TryCreate(
        $ArtworkUrl,
        [UriKind]::Absolute,
        [ref]$ArtworkUri
    )) {
        throw "Spotify returned an invalid artwork URL."
    }

    if (
        $ArtworkUri.Scheme -ne "https" -or
        (
            $ArtworkUri.Host -ne "i.scdn.co" -and
            -not $ArtworkUri.Host.EndsWith(
                ".scdn.co",
                [StringComparison]::OrdinalIgnoreCase
            )
        )
    ) {
        throw "Spotify returned an unexpected artwork host."
    }

    $TempPath = "$CachePath.tmp"

    try {
        # HttpClient is substantially more reliable than Windows PowerShell's
        # legacy Invoke-WebRequest for binary CDN responses.
        Add-Type -AssemblyName System.Net.Http

        $Handler = New-Object System.Net.Http.HttpClientHandler
        $Handler.AllowAutoRedirect = $true

        $Client = New-Object System.Net.Http.HttpClient($Handler)
        $Client.Timeout = [TimeSpan]::FromSeconds(15)
        $Client.DefaultRequestHeaders.UserAgent.ParseAdd("DriveOS/1.2")

        try {
            $Response = $Client.GetAsync($ArtworkUri).GetAwaiter().GetResult()
            # EnsureSuccessStatusCode returns the response object. Suppress it so
            # this function emits only image bytes to Send-SpotifyArtwork.
            $null = $Response.EnsureSuccessStatusCode()

            $Bytes = $Response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        }
        finally {
            $Client.Dispose()
            $Handler.Dispose()
        }

        if (-not $Bytes -or $Bytes.Length -le 0 -or $Bytes.Length -gt 10MB) {
            throw "Spotify artwork response was invalid."
        }

        [IO.File]::WriteAllBytes($CachePath, $Bytes)
        return $Bytes
    }
    finally {
        Remove-Item $TempPath -Force -ErrorAction SilentlyContinue
    }
}

function Send-SpotifyArtwork {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$TrackId
    )

    $Bytes = Get-SpotifyArtworkBytes -TrackId $TrackId
    $MimeType = Get-ImageMimeType -Bytes $Bytes

    if ($MimeType -eq "application/octet-stream") {
        throw "Unsupported Spotify artwork format."
    }

    Send-HttpResponse `
        -Stream $Stream `
        -ContentType $MimeType `
        -Body $Bytes
}

function Get-SpotifyAuthorizationStatus {
    $Authorized = $false

    try {
        $null = Get-SpotifyAccessToken
        $Authorized = $true
    }
    catch {}

    return [PSCustomObject]@{
        authorized = $Authorized
        tokenFile  = (Test-Path $SpotifyTokenFile -PathType Leaf)
    }
}

function Start-SpotifyAuthorization {
    $Script = Join-Path $PSScriptRoot "Connect-Spotify.ps1"

    if (-not (Test-Path $Script -PathType Leaf)) {
        throw "Spotify authorization script is missing."
    }

    # Avoid exposing secrets in arguments. SPOTIFY_CLIENT_ID is inherited from
    # the DriveOS backend process environment by the child PowerShell process.
    Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", ('"' + $Script + '"')
        ) `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Normal | Out-Null

    return [PSCustomObject]@{
        started = $true
    }
}

function Get-LastFmConfiguration {
    if (-not (Test-Path $LastFmConfigFile -PathType Leaf)) {
        return $null
    }

    $Config = Read-DriveOSJson -Path $LastFmConfigFile
    $Username = "$($Config.Username)".Trim()
    $ApiKey = Unprotect-Token $Config.ApiKey

    if (-not $Username -or -not $ApiKey) {
        throw "Last.fm configuration is incomplete. Run Connect-LastFm.ps1 again."
    }

    return [PSCustomObject]@{
        username = $Username
        apiKey   = $ApiKey
    }
}

function Get-LastFmConnectionStatus {
    try {
        $Config = Get-LastFmConfiguration
        return [PSCustomObject]@{
            configured = ($null -ne $Config)
            username   = if ($Config) { $Config.username } else { $null }
        }
    }
    catch {
        return [PSCustomObject]@{
            configured = $false
            username   = $null
        }
    }
}

function Start-LastFmConfiguration {
    $Script = Join-Path $PSScriptRoot "Connect-LastFm.ps1"

    if (-not (Test-Path $Script -PathType Leaf)) {
        throw "Last.fm configuration script is missing."
    }

    Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", ('"' + $Script + '"')
        ) `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Normal | Out-Null

    return [PSCustomObject]@{ started = $true }
}

function Get-FoursquareConfiguration {
    if (-not (Test-Path $FoursquareConfigFile -PathType Leaf)) { return $null }

    $Config = Read-DriveOSJson -Path $FoursquareConfigFile
    $ApiKey = Unprotect-Token $Config.ApiKey
    if (-not $ApiKey) {
        throw "Foursquare configuration is incomplete. Run Connect-Foursquare.ps1 again."
    }

    $script:FoursquareApiKeyForRedaction = $ApiKey
    return [PSCustomObject]@{ apiKey = $ApiKey }
}

function Get-FoursquareUsageRecord {
    if (-not (Test-Path $FoursquareUsageFile -PathType Leaf)) { return $null }
    try { return Read-DriveOSJson -Path $FoursquareUsageFile }
    catch { return $null }
}

function Get-FoursquareCacheEntries {
    if (-not (Test-Path $FoursquareCacheFile -PathType Leaf)) { return @() }
    try {
        $Record = Read-DriveOSJson -Path $FoursquareCacheFile
        if ($Record -and $Record.PSObject.Properties['entries']) { return @($Record.entries) }
    }
    catch {}
    return @()
}

function Save-FoursquareCacheEntries {
    param([object[]]$Entries)
    Write-DriveOSJson -Path $FoursquareCacheFile -Value ([PSCustomObject]@{
        version = 1
        updatedAt = (Get-Date).ToString('o')
        entries = @($Entries)
    })
}

function Get-FoursquareCacheMap {
    $Map = @{}
    foreach ($Entry in @(Get-FoursquareCacheEntries)) {
        if ($Entry.key) { $Map[[string]$Entry.key] = $Entry }
    }
    return $Map
}

function Get-FoursquareConnectionStatus {
    $Configured = $false
    try { $Configured = ($null -ne (Get-FoursquareConfiguration)) } catch {}
    $UsageRecord = Get-FoursquareUsageRecord
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage $UsageRecord `
        -DailyLimit $FoursquareDailyLimit -MonthlyLimit $FoursquareMonthlyLimit
    $Cache = @(Get-FoursquareCacheEntries)

    return [PSCustomObject]@{
        configured = $Configured
        cachedCount = @($Cache | Where-Object { $_.status -eq 'matched' }).Count
        todayUsed = [int]$Usage.dayCount
        todayLimit = [int]$Usage.dayLimit
        todayRemaining = [int]$Usage.dayRemaining
        monthUsed = [int]$Usage.monthCount
        monthLimit = [int]$Usage.monthLimit
        monthRemaining = [int]$Usage.monthRemaining
        canCall = [bool]$Usage.canCall
        lastError = if ($UsageRecord -and $UsageRecord.PSObject.Properties['lastError']) { [string]$UsageRecord.lastError } else { $null }
    }
}

function Set-FoursquareLastError {
    param([string]$Message)
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage (Get-FoursquareUsageRecord) `
        -DailyLimit $FoursquareDailyLimit -MonthlyLimit $FoursquareMonthlyLimit
    Write-DriveOSJson -Path $FoursquareUsageFile -Value ([PSCustomObject]@{
        version = 1
        day = $Usage.day
        dayCount = [int]$Usage.dayCount
        month = $Usage.month
        monthCount = [int]$Usage.monthCount
        lastError = if ($Message) { $Message } else { $null }
        lastErrorAt = if ($Message) { (Get-Date).ToString('o') } else { $null }
        updatedAt = (Get-Date).ToString('o')
    })
}

function Register-FoursquareApiCall {
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage (Get-FoursquareUsageRecord) `
        -DailyLimit $FoursquareDailyLimit -MonthlyLimit $FoursquareMonthlyLimit
    if (-not $Usage.canCall) { return $false }

    Write-DriveOSJson -Path $FoursquareUsageFile -Value ([PSCustomObject]@{
        version = 1
        day = $Usage.day
        dayCount = ([int]$Usage.dayCount + 1)
        month = $Usage.month
        monthCount = ([int]$Usage.monthCount + 1)
        lastError = $null
        lastErrorAt = $null
        updatedAt = (Get-Date).ToString('o')
    })
    return $true
}

function Start-FoursquareConfiguration {
    $Script = Join-Path $PSScriptRoot "Connect-Foursquare.ps1"
    if (-not (Test-Path $Script -PathType Leaf)) {
        throw "Foursquare configuration script is missing."
    }

    Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"' + $Script + '"')) `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Normal | Out-Null
    return [PSCustomObject]@{ started = $true }
}

function Get-FoursquareCachedPlace {
    param([string]$Location, $Latitude = $null, $Longitude = $null)
    $Key = Get-DriveOSPlaceCacheKey -Location $Location -Latitude $Latitude -Longitude $Longitude
    if (-not $Key) { return $null }
    $Map = Get-FoursquareCacheMap
    if ($Map.ContainsKey($Key) -and $Map[$Key].status -eq 'matched') { return $Map[$Key] }
    return $null
}

function Resolve-FoursquareCandidatePlaces {
    param([object[]]$Candidates = @())

    $Configuration = $null
    try { $Configuration = Get-FoursquareConfiguration } catch {}
    if (-not $Configuration) { return 0 }

    $Entries = New-Object Collections.ArrayList
    foreach ($Entry in @(Get-FoursquareCacheEntries)) { [void]$Entries.Add($Entry) }
    $Map = @{}
    foreach ($Entry in @($Entries)) { if ($Entry.key) { $Map[[string]$Entry.key] = $Entry } }
    $NewMatches = 0
    $Client = New-FoursquareClient -ApiKey $Configuration.apiKey

    foreach ($Candidate in @(Select-DriveOSPlaceLookupCandidates -Candidates $Candidates -Limit 25)) {
        $Key = Get-DriveOSPlaceCacheKey -Location $Candidate.location -Latitude $Candidate.latitude -Longitude $Candidate.longitude
        if (-not $Key) { continue }

        if ($Map.ContainsKey($Key)) {
            $Existing = $Map[$Key]
            if ($Existing.status -eq 'matched') { continue }
            if ($Existing.status -eq 'none') {
                try {
                    if ([datetime]$Existing.resolvedAt -gt (Get-Date).AddDays(-30)) { continue }
                }
                catch {}
            }
        }

        if (-not (Register-FoursquareApiCall)) { break }

        try {
            $Places = @(Search-FoursquarePlaces -Client $Client `
                -Latitude ([double]$Candidate.latitude) -Longitude ([double]$Candidate.longitude) `
                -RadiusMeters 100 -Limit 5)
            $Match = Select-DriveOSFoursquareMatch -Places $Places -MaximumDistanceMeters 60
            $Entry = [PSCustomObject]@{
                key = $Key
                location = [string]$Candidate.location
                latitude = [double]$Candidate.latitude
                longitude = [double]$Candidate.longitude
                status = if ($Match) { 'matched' } else { 'none' }
                name = if ($Match) { [string]$Match.name } else { $null }
                fsqPlaceId = if ($Match) { [string]$Match.id } else { $null }
                category = if ($Match) { [string]$Match.category } else { $null }
                distanceMeters = if ($Match) { [double]$Match.distanceMeters } else { $null }
                resolvedAt = (Get-Date).ToString('o')
            }

            if ($Map.ContainsKey($Key)) {
                for ($Index = $Entries.Count - 1; $Index -ge 0; $Index--) {
                    if ($Entries[$Index].key -eq $Key) { $Entries.RemoveAt($Index) }
                }
            }
            [void]$Entries.Add($Entry)
            $Map[$Key] = $Entry
            Save-FoursquareCacheEntries -Entries @($Entries)
            Set-FoursquareLastError -Message $null
            if ($Match) { $NewMatches++ }
        }
        catch {
            Write-DriveOSServerLog "Foursquare place search failed: $($_.Exception.Message)"
            Set-FoursquareLastError -Message "Foursquare could not complete a search. Check or replace the Service API key."
            break
        }
    }

    return $NewMatches
}

function ConvertTo-ListeningIdentityText {
    param([string]$Value)

    if (-not $Value) { return "" }
    return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
}

function Get-ListeningIdentityKey {
    param(
        [string]$Track,
        [string]$Artist,
        [long]$UnixSeconds
    )

    return "{0}|{1}|{2}" -f `
        (ConvertTo-ListeningIdentityText $Track), `
        (ConvertTo-ListeningIdentityText $Artist), `
        $UnixSeconds
}

function Sync-LastFmHistory {
    param($SpotifyClient = $null)

    $Config = Get-LastFmConfiguration
    if (-not $Config) {
        return [PSCustomObject]@{
            configured = $false
            username   = $null
            added      = 0
            duplicates = 0
        }
    }

    $History = @(Get-SpotifyHistory)
    $Latest = [DateTimeOffset]::UtcNow.AddDays(-365)

    if (Test-Path $LastFmSyncStateFile -PathType Leaf) {
        try {
            $SyncState = Read-DriveOSJson -Path $LastFmSyncStateFile
            if (
                "$($SyncState.Username)" -eq $Config.username -and
                [long]$SyncState.CursorUnix -gt 0
            ) {
                $Latest = [DateTimeOffset]::FromUnixTimeSeconds([long]$SyncState.CursorUnix)
            }
        }
        catch {}
    }

    foreach ($Record in $History) {
        try {
            $IsLastFm = "$($Record.id)".StartsWith("lastfm|", [StringComparison]::OrdinalIgnoreCase) -or
                ($Record.PSObject.Properties['source'] -and "$($Record.source)" -eq "lastfm")

            if ($IsLastFm) {
                $Played = [DateTimeOffset]::Parse("$($Record.played_at)")
                if ($Played -gt $Latest) { $Latest = $Played }
            }
        }
        catch {}
    }

    # Re-read a small overlap so a Spotify play and its matching Last.fm
    # scrobble can be recognized even when the providers round differently.
    $FromUnix = $Latest.AddHours(-1).ToUnixTimeSeconds()
    $Client = New-LastFmClient -Username $Config.username -ApiKey $Config.apiKey
    $Items = @(Get-LastFmRecentTracks -Client $Client -FromUnix $FromUnix -MaxPages 50)
    $ExistingIds = @{}
    $ExistingIdentities = @{}

    foreach ($Record in $History) {
        if ($Record.id) { $ExistingIds["$($Record.id)"] = $true }

        try {
            $Seconds = [DateTimeOffset]::Parse("$($Record.played_at)").ToUnixTimeSeconds()
            $Identity = Get-ListeningIdentityKey -Track "$($Record.track)" -Artist "$($Record.artist)" -UnixSeconds $Seconds
            $ExistingIdentities[$Identity] = $true
        }
        catch {}
    }

    $Added = 0
    $Duplicates = 0
    $EnrichmentRemaining = 50

    foreach ($Item in @($Items | Sort-Object { [long]$_.date.uts })) {
        $Candidate = ConvertTo-DriveOSLastFmPlay -Item $Item

        if ($ExistingIds.ContainsKey("$($Candidate.id)")) {
            continue
        }

        $Seconds = [DateTimeOffset]::Parse($Candidate.played_at).ToUnixTimeSeconds()
        $IsDuplicate = $false

        for ($Offset = -10; $Offset -le 10; $Offset++) {
            $Identity = Get-ListeningIdentityKey `
                -Track $Candidate.track `
                -Artist $Candidate.artist `
                -UnixSeconds ($Seconds + $Offset)

            if ($ExistingIdentities.ContainsKey($Identity)) {
                $IsDuplicate = $true
                break
            }
        }

        if ($IsDuplicate) {
            $Duplicates++
            continue
        }

        if ($SpotifyClient -and $EnrichmentRemaining -gt 0) {
            $EnrichmentRemaining--
            try {
                $SpotifyTrack = Find-SpotifyTrack `
                    -Client $SpotifyClient `
                    -Track $Candidate.track `
                    -Artist $Candidate.artist

                if ($SpotifyTrack) {
                    $Candidate = ConvertTo-DriveOSLastFmPlay -Item $Item -SpotifyTrack $SpotifyTrack
                }
            }
            catch {
                # A scrobble remains useful without Spotify enrichment and can
                # still be matched to a drive by timestamp.
            }
        }

        Add-DriveOSListeningHistoryRecord -Repository $Repository -Record $Candidate
        $ExistingIds["$($Candidate.id)"] = $true
        $Identity = Get-ListeningIdentityKey -Track $Candidate.track -Artist $Candidate.artist -UnixSeconds $Seconds
        $ExistingIdentities[$Identity] = $true
        $Added++
    }

    $CursorUnix = [DateTimeOffset]::UtcNow.AddMinutes(-10).ToUnixTimeSeconds()
    if ($Items.Count -gt 0) {
        $NewestItemUnix = [long](($Items | ForEach-Object { [long]$_.date.uts } | Measure-Object -Maximum).Maximum)
        if ($NewestItemUnix -gt $CursorUnix) { $CursorUnix = $NewestItemUnix }
    }

    Write-DriveOSJson -Path $LastFmSyncStateFile -Value ([PSCustomObject]@{
        Version    = 1
        Username   = $Config.username
        CursorUnix = $CursorUnix
        LastSyncAt = [DateTimeOffset]::UtcNow.ToString("o")
    })

    return [PSCustomObject]@{
        configured = $true
        username   = $Config.username
        added      = $Added
        duplicates = $Duplicates
    }
}

function ConvertTo-PublicListeningPlay {
    param([Parameter(Mandatory=$true)]$Record)

    $Played = [DateTimeOffset]::Parse("$($Record.played_at)").ToLocalTime()
    $Source = if ($Record.PSObject.Properties['source']) { "$($Record.source)" } else { "spotify" }

    return [PSCustomObject]@{
        playedAt   = $Played.ToString("o")
        time       = $Played.ToString("h:mm tt")
        track      = $Record.track
        artist     = $Record.artist
        album      = $Record.album
        trackId    = $Record.track_id
        albumImage = $Record.album_image
        spotifyUrl = $Record.spotify_url
        source     = $Source
    }
}

function Get-SpotifySummary {
    $Items = @(Get-SpotifyRecent -Limit 50)
    $SpotifyAdded = Save-SpotifyHistory $Items
    $SpotifyClient = New-SpotifyClient -AccessToken (Get-SpotifyAccessToken)
    $LastFm = $null
    $LastFmError = $null

    try {
        $LastFm = Sync-LastFmHistory -SpotifyClient $SpotifyClient
    }
    catch {
        $LastFmError = "Last.fm sync is temporarily unavailable"
        Write-DriveOSServerLog "Last.fm sync failed: $($_.Exception.Message)"
        $LastFm = [PSCustomObject]@{
            configured = (Get-LastFmConnectionStatus).configured
            username   = (Get-LastFmConnectionStatus).username
            added      = 0
            duplicates = 0
        }
    }

    $History = @(Get-SpotifyHistory | Sort-Object {
        try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks }
        catch { 0 }
    } -Descending)
    $Recent = @($History | Select-Object -First 10 | ForEach-Object {
        ConvertTo-PublicListeningPlay -Record $_
    })
    $LastFmAdded = [int]$LastFm.added

    return [PSCustomObject]@{
        recent             = $Recent
        newlyArchived      = ($SpotifyAdded + $LastFmAdded)
        spotifyNewlyAdded  = $SpotifyAdded
        lastFmNewlyAdded   = $LastFmAdded
        archiveTotal       = $History.Count
        lastFmConfigured   = [bool]$LastFm.configured
        lastFmUsername     = $LastFm.username
        lastFmError        = $LastFmError
    }
}

# ------------------------------------------------------------
# Tessie
# ------------------------------------------------------------


# ------------------------------------------------------------
# DriveOS personal data helpers: friendly places / charging
# ------------------------------------------------------------

function Write-JsonFileUtf8NoBom {
    param(
        [string]$Path,
        $Object
    )

    Write-DriveOSJson -Path $Path -Value $Object
}

function Get-PlaceAliasEntries {
    if (-not (Test-Path $PlaceAliasesFile -PathType Leaf)) {
        return @()
    }

    try {
        $Parsed = Get-DriveOSPlaceAliases -Repository $Repository
        return @($Parsed)
    }
    catch {
        return @()
    }
}

function Get-PlaceAliasMap {
    return New-DriveOSPlaceAliasMap -Entries @(Get-PlaceAliasEntries)
}

function Get-FriendlyLocation {
    param([string]$Location, $Latitude = $null, $Longitude = $null)

    $AliasMap = Get-PlaceAliasMap
    $Friendly = Resolve-DriveOSFriendlyLocation -Location $Location -AliasMap $AliasMap
    if ($Friendly -ne $Location) { return $Friendly }

    $Business = Get-FoursquareCachedPlace -Location $Location -Latitude $Latitude -Longitude $Longitude
    if ($Business -and $Business.name) { return [string]$Business.name }
    return $Location
}

function Set-PlaceAlias {
    param(
        [string]$Location,
        [string]$Label
    )

    $Location = "$Location".Trim(); $Label = "$Label".Trim()
    $Entries = @(Update-DriveOSPlaceAliasEntries -Entries @(Get-PlaceAliasEntries) -Location $Location -Label $Label)

    Set-DriveOSPlaceAliases -Repository $Repository -Entries @($Entries)

    return [PSCustomObject]@{
        location = $Location
        label = $Label
        removed = -not [bool]$Label
    }
}

function Get-ChargingSettings {
    $Rate = $null

    if (Test-Path $ChargingSettingsFile -PathType Leaf) {
        try {
            $Parsed = Get-DriveOSChargingSettingsRecord -Repository $Repository
            if ($null -ne $Parsed.electricityRateCents) {
                $Rate = [double]$Parsed.electricityRateCents
            }
        }
        catch {}
    }

    return [PSCustomObject]@{
        electricityRateCents = $Rate
    }
}

function Set-ChargingSettings {
    param($ElectricityRateCents)

    $Rate = $null

    if ($null -ne $ElectricityRateCents -and "$ElectricityRateCents" -ne "") {
        $Rate = [double]$ElectricityRateCents
        if ($Rate -lt 0 -or $Rate -gt 200) {
            throw "Electricity rate must be between 0 and 200 cents per kWh."
        }
    }

    $Settings = [PSCustomObject]@{
        electricityRateCents = $Rate
    }

    Set-DriveOSChargingSettingsRecord -Repository $Repository -Settings $Settings
    return $Settings
}

function Get-PlaceCandidates {
    $Counts = @{}
    $Coordinates = @{}
    $AliasMap = Get-PlaceAliasMap

    foreach ($Drive in @(Get-RawDrives -Days 365)) {
        $Endpoints = @(
            [PSCustomObject]@{ location=$Drive.starting_location; latitude=$Drive.starting_latitude; longitude=$Drive.starting_longitude },
            [PSCustomObject]@{ location=$Drive.ending_location; latitude=$Drive.ending_latitude; longitude=$Drive.ending_longitude }
        )
        foreach ($Endpoint in $Endpoints) {
            $Value = "$($Endpoint.location)".Trim()
            if (-not $Value) { continue }
            if (-not $Counts.ContainsKey($Value)) { $Counts[$Value] = 0 }
            $Counts[$Value]++
            if (-not $Coordinates.ContainsKey($Value) -and $null -ne $Endpoint.latitude -and $null -ne $Endpoint.longitude) {
                $Coordinates[$Value] = [PSCustomObject]@{
                    latitude = [double]$Endpoint.latitude
                    longitude = [double]$Endpoint.longitude
                }
            }
        }
    }

    $Places = @($Counts.Keys | ForEach-Object {
        $Location = [string]$_
        $Coordinate = if ($Coordinates.ContainsKey($Location)) { $Coordinates[$Location] } else { $null }
        $ManualLabel = if ($AliasMap.ContainsKey($Location)) { [string]$AliasMap[$Location] } else { "" }
        $Business = Get-FoursquareCachedPlace -Location $Location `
            -Latitude $(if ($Coordinate) { $Coordinate.latitude } else { $null }) `
            -Longitude $(if ($Coordinate) { $Coordinate.longitude } else { $null })
        [PSCustomObject]@{
            location = $Location
            label = $ManualLabel
            manualLabel = $ManualLabel
            businessName = if ($Business) { [string]$Business.name } else { $null }
            businessCategory = if ($Business) { [string]$Business.category } else { $null }
            businessDistanceMeters = if ($Business) { $Business.distanceMeters } else { $null }
            displayName = if ($ManualLabel) { $ManualLabel } elseif ($Business) { [string]$Business.name } else { $Location }
            source = if ($ManualLabel) { 'manual' } elseif ($Business) { 'foursquare' } else { 'tessie' }
            uses = [int]$Counts[$Location]
            latitude = if ($Coordinate) { $Coordinate.latitude } else { $null }
            longitude = if ($Coordinate) { $Coordinate.longitude } else { $null }
        }
    })

    $NewMatches = Resolve-FoursquareCandidatePlaces -Candidates $Places
    if ($NewMatches -gt 0) {
        $CacheMap = Get-FoursquareCacheMap
        foreach ($Place in $Places) {
            if ($Place.manualLabel) { continue }
            $Key = Get-DriveOSPlaceCacheKey -Location $Place.location -Latitude $Place.latitude -Longitude $Place.longitude
            if ($Key -and $CacheMap.ContainsKey($Key) -and $CacheMap[$Key].status -eq 'matched') {
                $Business = $CacheMap[$Key]
                $Place.businessName = [string]$Business.name
                $Place.businessCategory = [string]$Business.category
                $Place.businessDistanceMeters = $Business.distanceMeters
                $Place.displayName = [string]$Business.name
                $Place.source = 'foursquare'
            }
        }
    }

    return [PSCustomObject]@{
        places = @($Places | Sort-Object @{Expression="uses";Descending=$true}, location)
        savedCount = @($AliasMap.Keys).Count
        newMatches = [int]$NewMatches
        foursquare = Get-FoursquareConnectionStatus
    }
}

function Get-RawCharges {
    param([ValidateRange(1, 730)][int]$Days = 365)

    $Vehicle = Get-VehicleRecord
    if (-not $Vehicle) { throw "No Tessie vehicle found." }

    $Vin = $Vehicle.vin
    $From = [DateTimeOffset]::Now.AddDays(-$Days).ToUnixTimeSeconds()
    $To = [DateTimeOffset]::Now.ToUnixTimeSeconds()

    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    $Response = Get-TessieHistoryRange -Client $Client -Vin $Vin -Resource charges -From $From -To $To -ExtraQuery "limit=1000&distance_format=mi"

    return @($Response.results | Sort-Object started_at -Descending)
}

function Convert-RawCharge {
    param($Charge)

    $Settings = Get-ChargingSettings
    return ConvertTo-DriveOSCharge -Charge $Charge -Settings $Settings -FriendlyLocation `
        (Get-FriendlyLocation -Location $Charge.location -Latitude $Charge.latitude -Longitude $Charge.longitude)
}

function Get-ChargingSummary {
    $Sessions = @()
    foreach ($Charge in @(Get-RawCharges -Days 365)) {
        $Sessions += Convert-RawCharge -Charge $Charge
    }

    $Cutoff30 = [DateTimeOffset]::Now.AddDays(-30)
    $Recent = @($Sessions | Where-Object { [DateTimeOffset]::Parse($_.startedAt) -ge $Cutoff30 })
    $TotalEnergy = [math]::Round((($Recent | Measure-Object energyAddedKWh -Sum).Sum), 2)
    $KnownCosts = @($Recent | Where-Object { $null -ne $_.displayCost })
    $TotalCost = if ($KnownCosts.Count) { [math]::Round((($KnownCosts | Measure-Object displayCost -Sum).Sum), 2) } else { $null }

    return [PSCustomObject]@{
        settings = Get-ChargingSettings
        summary30 = [PSCustomObject]@{
            sessions = $Recent.Count
            energyAddedKWh = $TotalEnergy
            cost = $TotalCost
            knownCostSessions = $KnownCosts.Count
            superchargerSessions = @($Recent | Where-Object isSupercharger).Count
        }
        sessions = $Sessions
    }
}


function Get-MonthlyRecaps {
    $Drives=@(Get-RecentDrives -Days 365)
    $Charges=@(Get-RawCharges -Days 365|ForEach-Object{Convert-RawCharge -Charge $_})
    return New-DriveOSMonthlyRecaps -Drives $Drives -Charges $Charges -Settings (Get-ChargingSettings)
}

function Get-TessieHeaders {
    return @{ Authorization = "Bearer $env:TESSIE_TOKEN" }
}

function Get-VehicleRecord {
    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    return Get-TessieVehicle -Client $Client
}

function Get-VehicleSummary {
    $Vehicle = Get-VehicleRecord

    if (-not $Vehicle) {
        throw "No Tessie vehicle found."
    }

    return ConvertTo-DriveOSVehicleSummary -Vehicle $Vehicle
}

function Get-RawDrives {
    param([ValidateRange(1, 730)][int]$Days = 30)

    $Vehicle = Get-VehicleRecord

    if (-not $Vehicle) {
        throw "No Tessie vehicle found."
    }

    $Vin = $Vehicle.vin
    $From = [DateTimeOffset]::Now.AddDays(-$Days).ToUnixTimeSeconds()
    $To = [DateTimeOffset]::Now.ToUnixTimeSeconds()

    $Uri = "https://api.tessie.com/$Vin/drives" +
           "?from=$From" +
           "&to=$To" +
           "&limit=1000" +
           "&distance_format=mi" +
           "&temperature_format=f"

    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    $Response = Get-TessieHistoryRange -Client $Client -Vin $Vin -Resource drives -From $From -To $To -ExtraQuery "limit=1000&distance_format=mi&temperature_format=f"

    return @($Response.results | Sort-Object started_at -Descending)
}

function Get-SoundtrackForWindow {
    param(
        [DateTimeOffset]$DriveStart,
        [DateTimeOffset]$DriveEnd,
        [object[]]$History = $null
    )

    if ($null -eq $History) {
        $History = @(Get-SpotifyHistory)
    }
    $Matches = @()

    foreach ($Record in $History) {
        try {
            $TrackStart = [DateTimeOffset]::Parse($Record.played_at)
            $DurationMs = 0

            if ($Record.duration_ms) {
                $DurationMs = [double]$Record.duration_ms
            }

            $TrackEnd = $TrackStart.AddMilliseconds($DurationMs)

            # Include any song whose playback interval overlaps the drive.
            if ($TrackStart -lt $DriveEnd -and $TrackEnd -gt $DriveStart) {
                $Local = $TrackStart.ToLocalTime()

                $AlbumImage = $Record.album_image
                $SpotifyUrl = $Record.spotify_url
                $AlbumSpotifyUrl = $Record.album_spotify_url
                $ResolvedDurationMs = $Record.duration_ms

                if (
                    (-not $AlbumImage -or -not $SpotifyUrl) -and
                    $Record.track_id
                ) {
                    $Metadata = Get-SpotifyTrackMetadata `
                        -TrackId $Record.track_id

                    if ($Metadata) {
                        if (-not $AlbumImage) {
                            $AlbumImage = $Metadata.albumImage
                        }

                        if (-not $SpotifyUrl) {
                            $SpotifyUrl = $Metadata.spotifyUrl
                        }

                        if (-not $AlbumSpotifyUrl) {
                            $AlbumSpotifyUrl = $Metadata.albumSpotifyUrl
                        }

                        if (-not $ResolvedDurationMs) {
                            $ResolvedDurationMs = $Metadata.durationMs
                        }
                    }
                }

                $Matches += [PSCustomObject]@{
                    playedAt        = $Local.ToString("o")
                    time            = $Local.ToString("h:mm tt")
                    track           = $Record.track
                    artist          = $Record.artist
                    album           = $Record.album
                    trackId         = (Get-SpotifyRecordTrackId -Record $Record)
                    trackUri        = if ($Record.track_uri) { $Record.track_uri } else { "spotify:track:$(Get-SpotifyRecordTrackId -Record $Record)" }
                    durationMs      = $ResolvedDurationMs
                    albumImage      = $AlbumImage
                    spotifyUrl      = $SpotifyUrl
                    albumSpotifyUrl = $AlbumSpotifyUrl
                }
            }
        }
        catch {}
    }

    return @($Matches | Sort-Object playedAt)
}

function Convert-RawDrive {
    param(
        $Drive,
        [object[]]$SpotifyHistory = $null
    )

    $Start=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.started_at).ToLocalTime();$End=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.ended_at).ToLocalTime()
    $Soundtrack=@(Get-SoundtrackForWindow -DriveStart $Start -DriveEnd $End -History $SpotifyHistory)
    return ConvertTo-DriveOSDrive -Drive $Drive -Soundtrack $Soundtrack `
        -StartingLocation (Get-FriendlyLocation -Location $Drive.starting_location -Latitude $Drive.starting_latitude -Longitude $Drive.starting_longitude) `
        -EndingLocation (Get-FriendlyLocation -Location $Drive.ending_location -Latitude $Drive.ending_latitude -Longitude $Drive.ending_longitude)
}

function Get-RecentDrives {
    param([ValidateRange(1, 730)][int]$Days = 30)

    $Output = @()
    $SpotifyHistory = @(Get-SpotifyHistory)

    foreach ($Raw in @(Get-RawDrives -Days $Days)) {
        $Output += Convert-RawDrive -Drive $Raw -SpotifyHistory $SpotifyHistory
    }

    return $Output
}


# ------------------------------------------------------------
# Drive map / historical GPS
# ------------------------------------------------------------

function Get-NearestHistoricalState {
    param(
        [object[]]$States,
        [long]$TargetTimestamp
    )

    return Find-NearestDriveOSHistoricalState -States $States -TargetTimestamp $TargetTimestamp
}

function Convert-HistoricalStateToMapPoint {
    param($State)

    return ConvertTo-DriveOSMapPoint -State $State
}

function Get-DriveMapData {
    param([string]$DriveId)

    if (-not $DriveId) {
        throw "driveId is required."
    }

    $IdParts = $DriveId -split "-"

    if ($IdParts.Count -ne 2) {
        throw "Invalid DriveOS drive ID."
    }

    $DriveStartEpoch = [long]$IdParts[0]
    $DriveEndEpoch = [long]$IdParts[1]

    if ($DriveEndEpoch -le $DriveStartEpoch) {
        throw "Invalid drive timeframe."
    }

    $DriveStart = [DateTimeOffset]::FromUnixTimeSeconds($DriveStartEpoch)
    $DriveEnd = [DateTimeOffset]::FromUnixTimeSeconds($DriveEndEpoch)

    # Confirm this timeframe is a Tessie drive we know about.
    $RawDrive = @(
        Get-RawDrives -Days 365 |
        Where-Object {
            [long]$_.started_at -eq $DriveStartEpoch -and
            [long]$_.ended_at -eq $DriveEndEpoch
        }
    ) | Select-Object -First 1

    if (-not $RawDrive) {
        throw "Drive could not be found in Tessie history."
    }

    $Vehicle = Get-VehicleRecord

    if (-not $Vehicle -or -not $Vehicle.vin) {
        throw "No Tessie vehicle VIN was available."
    }

    $Vin = $Vehicle.vin
    $Soundtrack = @(Get-SoundtrackForWindow -DriveStart $DriveStart -DriveEnd $DriveEnd)

    # If a soundtrack song began slightly before the drive and overlapped it,
    # include enough pre-drive history to locate where the song actually began.
    $StatesFrom = $DriveStartEpoch

    foreach ($Song in $Soundtrack) {
        try {
            $SongEpoch = [DateTimeOffset]::Parse(
                $Song.playedAt
            ).ToUnixTimeSeconds()

            if ($SongEpoch -lt $StatesFrom) {
                $StatesFrom = $SongEpoch
            }
        }
        catch {}
    }

    $StatesFrom = [math]::Max(0, $StatesFrom - 60)
    $StatesTo = $DriveEndEpoch + 60

    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    $StatesResponse = Get-TessieHistoryRange -Client $Client -Vin $Vin -Resource states -From $StatesFrom -To $StatesTo -ExtraQuery "interval=1&condense=false&distance_format=mi&temperature_format=f"

    $ValidStates = @(
        $StatesResponse.results |
        Where-Object {
            $null -ne $_.timestamp -and
            $null -ne $_.latitude -and
            $null -ne $_.longitude -and
            [double]$_.latitude -ge -90 -and
            [double]$_.latitude -le 90 -and
            [double]$_.longitude -ge -180 -and
            [double]$_.longitude -le 180
        } |
        Sort-Object timestamp
    )

    if ($ValidStates.Count -eq 0) {
        return [PSCustomObject]@{
            driveId       = $DriveId
            provider      = "OpenFreeMap"
            routePoints   = @()
            songMarkers   = @()
            startMarker   = $null
            endMarker     = $null
            stateCount    = 0
            message       = "Tessie returned no historical GPS states for this drive."
        }
    }

    $RouteStates = @(
        $ValidStates |
        Where-Object {
            [long]$_.timestamp -ge $DriveStartEpoch -and
            [long]$_.timestamp -le $DriveEndEpoch
        }
    )

    # Keep browser payloads reasonable on unusually long/high-frequency drives.
    if ($RouteStates.Count -gt 2500) {
        $Step = [int][math]::Ceiling($RouteStates.Count / 2500.0)
        $Sampled = @()

        for ($i = 0; $i -lt $RouteStates.Count; $i += $Step) {
            $Sampled += $RouteStates[$i]
        }

        if (
            $Sampled.Count -eq 0 -or
            $Sampled[$Sampled.Count - 1].timestamp -ne
                $RouteStates[$RouteStates.Count - 1].timestamp
        ) {
            $Sampled += $RouteStates[$RouteStates.Count - 1]
        }

        $RouteStates = $Sampled
    }

    $RoutePoints = @(
        $RouteStates |
        ForEach-Object {
            Convert-HistoricalStateToMapPoint $_
        }
    )

    $SongMarkers = @()
    $Index = 0

    foreach ($Song in $Soundtrack) {
        $Index++

        try {
            $SongEpoch = [DateTimeOffset]::Parse(
                $Song.playedAt
            ).ToUnixTimeSeconds()

            $Nearest = Get-NearestHistoricalState `
                -States $ValidStates `
                -TargetTimestamp $SongEpoch

            if ($Nearest) {
                $Difference = [math]::Abs(
                    [long]$Nearest.timestamp - [long]$SongEpoch
                )

                $Quality = if ($Difference -le 15) {
                    "exact"
                }
                elseif ($Difference -le 60) {
                    "close"
                }
                else {
                    "approximate"
                }

                $SongMarkers += [PSCustomObject]@{
                    index         = $Index
                    playedAt      = $Song.playedAt
                    time          = $Song.time
                    track         = $Song.track
                    artist        = $Song.artist
                    album         = $Song.album
                    trackId       = $Song.trackId
                    albumImage    = $Song.albumImage
                    spotifyUrl    = $Song.spotifyUrl
                    durationMs    = $Song.durationMs
                    latitude      = [double]$Nearest.latitude
                    longitude     = [double]$Nearest.longitude
                    speed         = $Nearest.speed
                    heading       = $Nearest.heading
                    battery       = $Nearest.battery_level
                    stateTime     = [DateTimeOffset]::FromUnixTimeSeconds(
                        [long]$Nearest.timestamp
                    ).ToLocalTime().ToString("h:mm:ss tt")
                    offsetSeconds = [int]$Difference
                    quality       = $Quality
                }
            }
            else {
                $SongMarkers += [PSCustomObject]@{
                    index         = $Index
                    playedAt      = $Song.playedAt
                    time          = $Song.time
                    track         = $Song.track
                    artist        = $Song.artist
                    album         = $Song.album
                    trackId       = $Song.trackId
                    albumImage    = $Song.albumImage
                    spotifyUrl    = $Song.spotifyUrl
                    durationMs    = $Song.durationMs
                    latitude      = $null
                    longitude     = $null
                    speed         = $null
                    heading       = $null
                    battery       = $null
                    stateTime     = $null
                    offsetSeconds = $null
                    quality       = "unavailable"
                }
            }
        }
        catch {
            $SongMarkers += [PSCustomObject]@{
                index         = $Index
                playedAt      = $Song.playedAt
                time          = $Song.time
                track         = $Song.track
                artist        = $Song.artist
                album         = $Song.album
                trackId       = $Song.trackId
                albumImage    = $Song.albumImage
                spotifyUrl    = $Song.spotifyUrl
                durationMs    = $Song.durationMs
                latitude      = $null
                longitude     = $null
                speed         = $null
                heading       = $null
                battery       = $null
                stateTime     = $null
                offsetSeconds = $null
                quality       = "unavailable"
            }
        }
    }

    $StartState = Get-NearestHistoricalState `
        -States $ValidStates `
        -TargetTimestamp $DriveStartEpoch

    $EndState = Get-NearestHistoricalState `
        -States $ValidStates `
        -TargetTimestamp $DriveEndEpoch

    return [PSCustomObject]@{
        driveId       = $DriveId
        provider      = "OpenFreeMap"
        routePoints   = $RoutePoints
        songMarkers   = $SongMarkers
        startMarker   = Convert-HistoricalStateToMapPoint $StartState
        endMarker     = Convert-HistoricalStateToMapPoint $EndState
        stateCount    = $ValidStates.Count
        message       = $null
    }
}

# ------------------------------------------------------------
# Music + aggregate statistics
# ------------------------------------------------------------

function Get-MusicStats {
    return New-DriveOSMusicStats -History @(Get-SpotifyHistory)
}

function Get-DriveStats {
    $Drives = @(Get-RecentDrives -Days 30)
    return New-DriveOSDriveStats -Drives $Drives -PeriodDays 30
}

# ------------------------------------------------------------
# Spotify playlist creation
# ------------------------------------------------------------

function New-DrivePlaylist {
    param([string]$DriveId)

    if (-not (Test-SpotifyScope "playlist-modify-private")) {
        throw "Spotify permission playlist-modify-private is missing. Run the updated Connect-Spotify.ps1 once, approve access, then try again."
    }

    $Drive = @(Get-RecentDrives -Days 365) |
        Where-Object { $_.id -eq $DriveId } |
        Select-Object -First 1

    if (-not $Drive) {
        throw "Drive could not be found."
    }

    $Token = Get-SpotifyAccessToken
    return New-DriveOSPlaylistFromDrive -Drive $Drive -SpotifyClient (New-SpotifyClient -AccessToken $Token)
}

# ------------------------------------------------------------
# Status
# ------------------------------------------------------------

function Get-OverallStatus {
    $VehicleOk = $false
    $SpotifyOk = $false
    $PlaylistScope = $false

    try {
        $null = Get-VehicleSummary
        $VehicleOk = $true
    }
    catch {}

    try {
        $null = Get-SpotifyAccessToken
        $SpotifyOk = $true
        $PlaylistScope = Test-SpotifyScope "playlist-modify-private"
    }
    catch {}

    $LastFmStatus = Get-LastFmConnectionStatus
    $FoursquareStatus = Get-FoursquareConnectionStatus

    return [PSCustomObject]@{
        driveOS       = "online"
        tessie        = $VehicleOk
        spotify       = $SpotifyOk
        lastfm        = [bool]$LastFmStatus.configured
        lastfmUsername = $LastFmStatus.username
        foursquare    = [bool]$FoursquareStatus.configured
        foursquareCached = [int]$FoursquareStatus.cachedCount
        playlistScope = $PlaylistScope
        time          = (Get-Date).ToString("o")
    }
}

# ------------------------------------------------------------
# Static files
# ------------------------------------------------------------

function Send-StaticFile {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$RequestPath
    )

    if ($RequestPath -eq "/") {
        $RequestPath = "/index.html"
    }

    try {
        $DecodedPath = [Uri]::UnescapeDataString($RequestPath)
    }
    catch {
        Send-Text -Stream $Stream -Text "Bad request" -StatusCode 400 -StatusText "Bad Request"
        return
    }

    if ($DecodedPath.IndexOf([char]0) -ge 0) {
        Send-Text -Stream $Stream -Text "Bad request" -StatusCode 400 -StatusText "Bad Request"
        return
    }

    $Relative = $DecodedPath.TrimStart("/", "\") -replace "[/\\]", [IO.Path]::DirectorySeparatorChar
    $Candidate = Join-Path $WebRoot $Relative

    try {
        $FullWebRoot = [IO.Path]::GetFullPath($WebRoot).TrimEnd(
            [IO.Path]::DirectorySeparatorChar,
            [IO.Path]::AltDirectorySeparatorChar
        )

        $RootPrefix = $FullWebRoot + [IO.Path]::DirectorySeparatorChar
        $FullCandidate = [IO.Path]::GetFullPath($Candidate)
    }
    catch {
        Send-Text -Stream $Stream -Text "Bad request" -StatusCode 400 -StatusText "Bad Request"
        return
    }

    if (-not $FullCandidate.StartsWith(
        $RootPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        Send-Text -Stream $Stream -Text "Forbidden" -StatusCode 403 -StatusText "Forbidden"
        return
    }

    if (-not (Test-Path $FullCandidate -PathType Leaf)) {
        Send-Text -Stream $Stream -Text "Not found" -StatusCode 404 -StatusText "Not Found"
        return
    }

    $Bytes = [IO.File]::ReadAllBytes($FullCandidate)

    Send-HttpResponse `
        -Stream $Stream `
        -ContentType (Get-MimeType $FullCandidate) `
        -Body $Bytes
}

# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

function Handle-Request {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$Method,
        [string]$Path,
        [string]$BodyText
    )

    try {
        if ($Method -eq "GET") {
            switch ($Path) {
                "/api/status" {
                    Send-Json -Stream $Stream -Object (Get-OverallStatus)
                    return
                }

                "/api/vehicle" {
                    Send-Json -Stream $Stream -Object (Get-VehicleSummary)
                    return
                }

                "/api/spotify/recent" {
                    Send-Json -Stream $Stream -Object (Get-SpotifySummary)
                    return
                }


                "/api/spotify/auth-status" {
                    Send-Json -Stream $Stream -Object (Get-SpotifyAuthorizationStatus)
                    return
                }

                "/api/lastfm/status" {
                    Send-Json -Stream $Stream -Object (Get-LastFmConnectionStatus)
                    return
                }

                "/api/foursquare/status" {
                    Send-Json -Stream $Stream -Object (Get-FoursquareConnectionStatus)
                    return
                }

                "/api/music/stats" {
                    Send-Json -Stream $Stream -Object (Get-MusicStats)
                    return
                }

                "/api/drives" {
                    Send-Json -Stream $Stream -Object @{
                        windowDays = 365
                        drives     = @(Get-RecentDrives -Days 365)
                    }
                    return
                }

                "/api/statistics" {
                    Send-Json -Stream $Stream -Object (Get-DriveStats)
                    return
                }

                "/api/places" {
                    Send-Json -Stream $Stream -Object (Get-PlaceCandidates)
                    return
                }

                "/api/charging" {
                    Send-Json -Stream $Stream -Object (Get-ChargingSummary)
                    return
                }

                "/api/recap" {
                    Send-Json -Stream $Stream -Object (Get-MonthlyRecaps)
                    return
                }

                default {
                    if ($Path -match "^/api/spotify/artwork/([A-Za-z0-9]{10,64})$") {
                        Send-SpotifyArtwork `
                            -Stream $Stream `
                            -TrackId $Matches[1]

                        return
                    }

                    if ($Path.StartsWith("/api/")) {
                        Send-Json -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Object @{
                            error = "API endpoint not found."
                        }
                        return
                    }

                    Send-StaticFile -Stream $Stream -RequestPath $Path
                    return
                }
            }
        }

        if ($Method -eq "POST") {
            switch ($Path) {

                "/api/spotify/connect" {
                    Send-Json -Stream $Stream -Object (Start-SpotifyAuthorization)
                    return
                }

                "/api/lastfm/configure" {
                    Send-Json -Stream $Stream -Object (Start-LastFmConfiguration)
                    return
                }

                "/api/foursquare/configure" {
                    Send-Json -Stream $Stream -Object (Start-FoursquareConfiguration)
                    return
                }

                "/api/places/alias" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText
                    Send-Json -Stream $Stream -Object (Set-PlaceAlias -Location $Body.location -Label $Body.label)
                    return
                }

                "/api/charging/settings" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText
                    Send-Json -Stream $Stream -Object (Set-ChargingSettings -ElectricityRateCents $Body.electricityRateCents)
                    return
                }

                "/api/drive/map" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId

                    Send-Json -Stream $Stream -Object (Get-DriveMapData -DriveId $Body.driveId)
                    return
                }

                "/api/playlist/create" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId

                    Send-Json -Stream $Stream -Object (New-DrivePlaylist -DriveId $Body.driveId)
                    return
                }

                default {
                    Send-Json -Stream $Stream -StatusCode 404 -StatusText "Not Found" -Object @{
                        error = "API endpoint not found."
                    }
                    return
                }
            }
        }

        Send-Json -Stream $Stream -StatusCode 405 -StatusText "Method Not Allowed" -Object @{
            error = "Method not allowed."
        }
    }
    catch {
        $Message = $_.Exception.Message
        $ErrorResponse = Get-DriveOSHttpError -Message $Message
        $Code = $ErrorResponse.statusCode
        $Text = $ErrorResponse.statusText
        $PublicMessage = $ErrorResponse.publicMessage

        Write-DriveOSServerLog "$Method $Path failed: $Message"

        Send-Json -Stream $Stream -StatusCode $Code -StatusText $Text -Object @{
            error = $PublicMessage
        }
    }
}

# ------------------------------------------------------------
# Hardened local backend server
# ------------------------------------------------------------

if (-not (Test-Path (Join-Path $WebRoot "index.html"))) {
    throw "web\index.html was not found."
}

function Test-DriveOSParentAlive {
    try {
        $Process = Get-Process -Id $ParentPid -ErrorAction Stop
        $ActualTicks = $Process.StartTime.ToUniversalTime().Ticks

        return (-not $Process.HasExited) -and ($ActualTicks -eq $ParentStartTicks)
    }
    catch {
        return $false
    }
}

function Send-RequestRejected {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$Code,
        [string]$Text,
        [string]$Message
    )

    Send-Json `
        -Stream $Stream `
        -StatusCode $Code `
        -StatusText $Text `
        -Object @{ error = $Message }
}

$Listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Parse($HostAddress),
    $Port
)

$Listener.Start()

try {
    while (Test-DriveOSParentAlive) {
        $AcceptResult = $Listener.BeginAcceptTcpClient($null, $null)

        while (-not $AcceptResult.IsCompleted) {
            if (-not (Test-DriveOSParentAlive)) {
                break
            }

            Start-Sleep -Milliseconds 100
        }

        if (-not (Test-DriveOSParentAlive)) {
            break
        }

        if (-not $AcceptResult.IsCompleted) {
            continue
        }

        $Client = $Listener.EndAcceptTcpClient($AcceptResult)
        $Stream = $null
        $Reader = $null

        try {
            $Remote = $Client.Client.RemoteEndPoint

            if ($Remote -isnot [System.Net.IPEndPoint] -or
                -not [System.Net.IPAddress]::IsLoopback($Remote.Address)) {
                $Client.Close()
                continue
            }

            $Stream = $Client.GetStream()
            $Stream.ReadTimeout = 10000
            $Stream.WriteTimeout = 10000

            $Reader = New-Object System.IO.StreamReader(
                $Stream,
                [System.Text.Encoding]::ASCII,
                $false,
                8192,
                $true
            )

            $RequestLine = $Reader.ReadLine()

            if (-not $RequestLine -or $RequestLine.Length -gt $MaxRequestLineBytes) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid request."

                continue
            }

            $Headers = @{}
            $HeaderBytes = 0
            $HeaderRejected = $false

            while (($Line = $Reader.ReadLine()) -ne $null) {
                if ($Line -eq "") { break }

                $HeaderBytes += $Line.Length + 2

                if ($HeaderBytes -gt $MaxHeaderBytes -or
                    $Line.StartsWith(" ") -or
                    $Line.StartsWith("`t")) {
                    $HeaderRejected = $true
                    break
                }

                $Colon = $Line.IndexOf(":")

                if ($Colon -le 0) {
                    $HeaderRejected = $true
                    break
                }

                $Key = $Line.Substring(0, $Colon).Trim().ToLowerInvariant()
                $Value = $Line.Substring($Colon + 1).Trim()

                if ($Headers.ContainsKey($Key)) {
                    # Duplicate security-sensitive headers are rejected.
                    if ($Key -in @(
                        "host",
                        "content-length",
                        "transfer-encoding",
                        "x-driveos-session",
                        "tailscale-user-login",
                        "tailscale-user-name",
                        "tailscale-user-profile-pic",
                        "origin"
                    )) {
                        $HeaderRejected = $true
                        break
                    }

                    $Headers[$Key] = "$($Headers[$Key]), $Value"
                }
                else {
                    $Headers[$Key] = $Value
                }
            }

            if ($HeaderRejected) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid request headers."

                continue
            }

            if (-not $Headers.ContainsKey("host")) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid host."

                continue
            }

            $RequestHost = $Headers["host"].ToLowerInvariant()
            $IsLocalDesktopRequest = $RequestHost -eq $ExpectedHostHeader
            $IsTailscaleHost = $RequestHost -match $TailscaleHostPattern

            $LocalSessionOk =
                $IsLocalDesktopRequest -and
                $Headers.ContainsKey("x-driveos-session") -and
                (Test-FixedTimeStringEquals `
                    $Headers["x-driveos-session"] `
                    $SessionToken)

            # Tailscale Serve strips user-supplied identity headers and injects
            # authenticated identity headers on tailnet traffic. DriveOS still
            # listens only on localhost, matching Tailscale's recommended setup.
            $TailscaleIdentityOk =
                $Headers.ContainsKey("tailscale-user-login") -and
                -not [String]::IsNullOrWhiteSpace($Headers["tailscale-user-login"]) -and
                $Headers["tailscale-user-login"].Length -le 512

            # Reverse proxies may preserve the original ts.net Host or rewrite it
            # to the localhost target. Both are acceptable only when a verified
            # Tailscale identity header is present.
            $RemoteHostOk = $IsLocalDesktopRequest -or $IsTailscaleHost

            if (-not $LocalSessionOk -and (-not $TailscaleIdentityOk -or -not $RemoteHostOk)) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 403 `
                    -Text "Forbidden" `
                    -Message "DriveOS session authentication failed."

                continue
            }

            $IsRemoteTailscaleRequest = $TailscaleIdentityOk

            if ($Headers.ContainsKey("transfer-encoding")) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Transfer encoding is not supported."

                continue
            }

            $Parts = $RequestLine -split " "

            if ($Parts.Count -ne 3 -or
                $Parts[2] -notin @("HTTP/1.1", "HTTP/1.0")) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid request line."

                continue
            }

            $Method = $Parts[0].ToUpperInvariant()
            $Target = $Parts[1]

            if ($Method -notin @("GET", "POST")) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 405 `
                    -Text "Method Not Allowed" `
                    -Message "Method not allowed."

                continue
            }

            if (-not $Target.StartsWith("/")) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid request target."

                continue
            }

            if ($IsRemoteTailscaleRequest -and $Method -eq "POST") {
                $RemoteOriginOk = $false

                if ($Headers.ContainsKey("origin")) {
                    try {
                        $OriginUri = [Uri]$Headers["origin"]
                        $RemoteOriginOk =
                            $OriginUri.Scheme -eq "https" -and
                            $OriginUri.Host -match "\.ts\.net$" -and
                            $OriginUri.Port -eq 443
                    } catch {
                        $RemoteOriginOk = $false
                    }
                }

                if (-not $RemoteOriginOk) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "Remote request origin validation failed."

                    continue
                }

                if ($Headers.ContainsKey("sec-fetch-site") -and
                    $Headers["sec-fetch-site"] -notin @("same-origin", "none")) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "Cross-site requests are not allowed."

                    continue
                }
            }

            $Path = ($Target -split "\?", 2)[0]
            $BodyText = ""

            $ContentLength = 0

            if ($Headers.ContainsKey("content-length")) {
                if (-not [int]::TryParse(
                    $Headers["content-length"],
                    [ref]$ContentLength
                ) -or
                    $ContentLength -lt 0 -or
                    $ContentLength -gt $MaxBodyBytes) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 413 `
                        -Text "Payload Too Large" `
                        -Message "Request body is too large."

                    continue
                }
            }

            if ($Method -eq "POST") {
                if (-not $Headers.ContainsKey("content-type") -or
                    -not $Headers["content-type"].StartsWith(
                        "application/json",
                        [StringComparison]::OrdinalIgnoreCase
                    )) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 415 `
                        -Text "Unsupported Media Type" `
                        -Message "DriveOS POST requests require application/json."

                    continue
                }
            }

            if ($ContentLength -gt 0) {
                $Buffer = New-Object char[] $ContentLength
                $Read = 0

                while ($Read -lt $ContentLength) {
                    $Count = $Reader.Read(
                        $Buffer,
                        $Read,
                        $ContentLength - $Read
                    )

                    if ($Count -le 0) {
                        break
                    }

                    $Read += $Count
                }

                if ($Read -ne $ContentLength) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 400 `
                        -Text "Bad Request" `
                        -Message "Incomplete request body."

                    continue
                }

                $BodyText = -join $Buffer
            }

            Handle-Request `
                -Stream $Stream `
                -Method $Method `
                -Path $Path `
                -BodyText $BodyText
        }
        catch {
            Write-DriveOSServerLog "HTTP request processing failed: $($_.Exception.Message)"

            try {
                if ($Stream) {
                    Send-Json `
                        -Stream $Stream `
                        -StatusCode 500 `
                        -StatusText "Internal Server Error" `
                        -Object @{
                            error = "DriveOS request failed."
                        }
                }
            }
            catch {}
        }
        finally {
            if ($Reader) {
                try { $Reader.Dispose() } catch {}
            }

            if ($Stream) {
                try { $Stream.Dispose() } catch {}
            }

            if ($Client) {
                try { $Client.Dispose() } catch {}
            }
        }
    }
}
finally {
    try { $Listener.Stop() } catch {}
}
