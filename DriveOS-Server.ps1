param(
    [int]$ParentPid = 0,
    [Int64]$ParentStartTicks = 0
)

$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Repositories\DriveOS.Repository.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Tessie\DriveOS.Tessie.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Vehicle\DriveOS.Vehicle.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Domain\Replay\DriveOS.Replay.psm1") -Force

# ============================================================
# DriveOS 3.2
# Windows PowerShell 5.1 compatible
#
# DriveOS.exe -> authenticated localhost backend -> Tessie / Spotify
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
$PlaceAliasesFile = Join-Path $DataDirectory "place-aliases.json"
$ChargingSettingsFile = Join-Path $DataDirectory "charging-settings.json"
$Repository = New-DriveOSRepository -DataDirectory $DataDirectory

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
            $SessionToken
        )) {
            if ($Secret) {
                $SafeMessage = $SafeMessage.Replace($Secret, "[REDACTED]")
            }
        }

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

    if (-not (Test-Path $SpotifyHistoryFile)) {
        return $Records
    }

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
            $Response.EnsureSuccessStatusCode()

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

function Get-SpotifySummary {
    $Items = @(Get-SpotifyRecent -Limit 50)
    $Added = Save-SpotifyHistory $Items

    $Recent = @()

    foreach ($Item in ($Items | Select-Object -First 10)) {
        $Played = [DateTimeOffset]::Parse($Item.played_at).ToLocalTime()
        $Artists = ($Item.track.artists | ForEach-Object { $_.name }) -join ", "

        $AlbumImage = $null

        if ($Item.track.album.images -and $Item.track.album.images.Count -gt 0) {
            $AlbumImage = $Item.track.album.images[0].url
        }

        $Recent += [PSCustomObject]@{
            playedAt   = $Played.ToString("o")
            time       = $Played.ToString("h:mm tt")
            track      = $Item.track.name
            artist     = $Artists
            album      = $Item.track.album.name
            trackId    = $Item.track.id
            albumImage = $AlbumImage
            spotifyUrl = $Item.track.external_urls.spotify
        }
    }

    $History = @(Get-SpotifyHistory)

    return [PSCustomObject]@{
        recent        = $Recent
        newlyArchived = $Added
        archiveTotal  = $History.Count
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
    $Map = @{}

    foreach ($Entry in @(Get-PlaceAliasEntries)) {
        if ($Entry.location -and $Entry.label) {
            $Map[[string]$Entry.location] = [string]$Entry.label
        }
    }

    return $Map
}

function Get-FriendlyLocation {
    param([string]$Location)

    if ([string]::IsNullOrWhiteSpace($Location)) {
        return $Location
    }

    $Map = Get-PlaceAliasMap
    if ($Map.ContainsKey($Location)) {
        return $Map[$Location]
    }

    return $Location
}

function Set-PlaceAlias {
    param(
        [string]$Location,
        [string]$Label
    )

    $Location = "$Location".Trim()
    $Label = "$Label".Trim()

    if (-not $Location -or $Location.Length -gt 512) {
        throw "A valid location is required."
    }

    if ($Label.Length -gt 64) {
        throw "Friendly place names must be 64 characters or fewer."
    }

    $Entries = New-Object System.Collections.ArrayList
    $Found = $false

    foreach ($Entry in @(Get-PlaceAliasEntries)) {
        if ([string]$Entry.location -eq $Location) {
            $Found = $true
            if ($Label) {
                [void]$Entries.Add([PSCustomObject]@{
                    location = $Location
                    label = $Label
                })
            }
        }
        else {
            [void]$Entries.Add([PSCustomObject]@{
                location = [string]$Entry.location
                label = [string]$Entry.label
            })
        }
    }

    if (-not $Found -and $Label) {
        [void]$Entries.Add([PSCustomObject]@{
            location = $Location
            label = $Label
        })
    }

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
    $AliasMap = Get-PlaceAliasMap

    foreach ($Drive in @(Get-RawDrives -Days 365)) {
        foreach ($Location in @($Drive.starting_location, $Drive.ending_location)) {
            $Value = "$Location".Trim()
            if (-not $Value) { continue }
            if (-not $Counts.ContainsKey($Value)) { $Counts[$Value] = 0 }
            $Counts[$Value]++
        }
    }

    $Places = foreach ($Location in $Counts.Keys) {
        [PSCustomObject]@{
            location = $Location
            label = if ($AliasMap.ContainsKey($Location)) { $AliasMap[$Location] } else { "" }
            uses = [int]$Counts[$Location]
        }
    }

    return [PSCustomObject]@{
        places = @($Places | Sort-Object @{Expression="uses";Descending=$true}, location)
        savedCount = @($AliasMap.Keys).Count
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

    $Start = [DateTimeOffset]::FromUnixTimeSeconds([long]$Charge.started_at).ToLocalTime()
    $End = [DateTimeOffset]::FromUnixTimeSeconds([long]$Charge.ended_at).ToLocalTime()
    $DurationMinutes = [math]::Max(0, [math]::Round(($End - $Start).TotalMinutes))
    $EnergyAdded = if ($null -ne $Charge.energy_added) { [math]::Round([double]$Charge.energy_added, 2) } else { $null }
    $RecordedCost = if ($null -ne $Charge.cost -and [double]$Charge.cost -gt 0) { [math]::Round([double]$Charge.cost, 2) } else { $null }
    $Settings = Get-ChargingSettings
    $EstimatedCost = $null

    if ($null -eq $RecordedCost -and $null -ne $EnergyAdded -and $null -ne $Settings.electricityRateCents) {
        $EstimatedCost = [math]::Round($EnergyAdded * ([double]$Settings.electricityRateCents / 100), 2)
    }

    return [PSCustomObject]@{
        id = [string]$Charge.id
        startedAt = $Start.ToString("o")
        endedAt = $End.ToString("o")
        dateLabel = $Start.ToString("ddd, MMM d")
        dateIso = $Start.ToString("yyyy-MM-dd")
        startTime = $Start.ToString("h:mm tt")
        endTime = $End.ToString("h:mm tt")
        durationMinutes = $DurationMinutes
        location = (Get-FriendlyLocation -Location $Charge.location)
        rawLocation = $Charge.location
        latitude = $Charge.latitude
        longitude = $Charge.longitude
        isSupercharger = [bool]$Charge.is_supercharger
        odometer = $Charge.odometer
        energyAddedKWh = $EnergyAdded
        energyUsedKWh = if ($null -ne $Charge.energy_used) { [math]::Round([double]$Charge.energy_used, 2) } else { $null }
        milesAdded = if ($null -ne $Charge.miles_added) { [math]::Round([double]$Charge.miles_added, 1) } else { $null }
        startingBattery = $Charge.starting_battery
        endingBattery = $Charge.ending_battery
        recordedCost = $RecordedCost
        estimatedCost = $EstimatedCost
        displayCost = if ($null -ne $RecordedCost) { $RecordedCost } else { $EstimatedCost }
        costType = if ($null -ne $RecordedCost) { "recorded" } elseif ($null -ne $EstimatedCost) { "estimated" } else { "unknown" }
    }
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
    $Drives = @(Get-RecentDrives -Days 365)
    $Charges = @(Get-RawCharges -Days 365 | ForEach-Object { Convert-RawCharge -Charge $_ })
    $Now = Get-Date
    $Recaps = @()

    for ($Offset = 0; $Offset -lt 12; $Offset++) {
        $MonthStart = Get-Date -Year $Now.AddMonths(-$Offset).Year -Month $Now.AddMonths(-$Offset).Month -Day 1
        $MonthEnd = $MonthStart.AddMonths(1)
        $MonthDrives = @($Drives | Where-Object {
            $D = [DateTimeOffset]::Parse($_.startedAt).LocalDateTime
            $D -ge $MonthStart -and $D -lt $MonthEnd
        })
        $MonthCharges = @($Charges | Where-Object {
            $D = [DateTimeOffset]::Parse($_.startedAt).LocalDateTime
            $D -ge $MonthStart -and $D -lt $MonthEnd
        })

        $Miles = [math]::Round((($MonthDrives | Measure-Object miles -Sum).Sum), 1)
        $Energy = [math]::Round((($MonthDrives | Measure-Object energyKWh -Sum).Sum), 2)
        $Battery = [math]::Round((($MonthDrives | Measure-Object batteryUsed -Sum).Sum))
        $Songs = [int](($MonthDrives | Measure-Object songCount -Sum).Sum)
        $AverageWhMi = if ($Miles -gt 0 -and $Energy -gt 0) { [math]::Round(($Energy * 1000) / $Miles) } else { $null }

        $Routes = @{}
        $Tracks = @{}
        $Artists = @{}

        foreach ($Drive in $MonthDrives) {
            $Route = "$($Drive.startingLocation) -> $($Drive.endingLocation)"
            if (-not $Routes.ContainsKey($Route)) { $Routes[$Route] = 0 }
            $Routes[$Route]++

            foreach ($Song in @($Drive.soundtrack)) {
                $TrackKey = "$($Song.track)`0$($Song.artist)"
                if (-not $Tracks.ContainsKey($TrackKey)) { $Tracks[$TrackKey] = 0 }
                $Tracks[$TrackKey]++
                if ($Song.artist) {
                    if (-not $Artists.ContainsKey([string]$Song.artist)) { $Artists[[string]$Song.artist] = 0 }
                    $Artists[[string]$Song.artist]++
                }
            }
        }

        $FavoriteRoute = $Routes.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
        $TopTrackEntry = $Tracks.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
        $TopArtistEntry = $Artists.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
        $Longest = $MonthDrives | Sort-Object miles -Descending | Select-Object -First 1
        $ChargeEnergy = [math]::Round((($MonthCharges | Measure-Object energyAddedKWh -Sum).Sum), 2)
        $KnownChargeCosts = @($MonthCharges | Where-Object { $null -ne $_.displayCost })
        $ChargeCost = if ($KnownChargeCosts.Count) { [math]::Round((($KnownChargeCosts | Measure-Object displayCost -Sum).Sum), 2) } else { $null }
        $TrackName = $null
        $TrackArtist = $null

        if ($TopTrackEntry) {
            $Parts = [string]$TopTrackEntry.Name -split "`0", 2
            $TrackName = $Parts[0]
            if ($Parts.Count -gt 1) { $TrackArtist = $Parts[1] }
        }

        $Recaps += [PSCustomObject]@{
            monthKey = $MonthStart.ToString("yyyy-MM")
            monthLabel = $MonthStart.ToString("MMMM yyyy")
            driveCount = $MonthDrives.Count
            miles = $Miles
            driveEnergyKWh = $Energy
            averageWhMi = $AverageWhMi
            batteryUsed = $Battery
            soundtrackPlays = $Songs
            uniqueSongs = @($Tracks.Keys).Count
            favoriteRoute = if ($FavoriteRoute) { $FavoriteRoute.Name } else { $null }
            favoriteRouteCount = if ($FavoriteRoute) { [int]$FavoriteRoute.Value } else { 0 }
            longestDriveMiles = if ($Longest) { $Longest.miles } else { $null }
            longestDriveDate = if ($Longest) { $Longest.shortDateLabel } else { $null }
            topTrack = $TrackName
            topTrackArtist = $TrackArtist
            topTrackPlays = if ($TopTrackEntry) { [int]$TopTrackEntry.Value } else { 0 }
            topArtist = if ($TopArtistEntry) { $TopArtistEntry.Name } else { $null }
            topArtistPlays = if ($TopArtistEntry) { [int]$TopArtistEntry.Value } else { 0 }
            chargingSessions = $MonthCharges.Count
            chargingEnergyKWh = $ChargeEnergy
            chargingCost = $ChargeCost
            chargingKnownCostSessions = $KnownChargeCosts.Count
        }
    }

    return [PSCustomObject]@{
        recaps = $Recaps
        settings = Get-ChargingSettings
    }
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

    $Start = [DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.started_at).ToLocalTime()
    $End = [DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.ended_at).ToLocalTime()

    $DurationMinutes = [math]::Max(
        0,
        [math]::Round(($End - $Start).TotalMinutes)
    )

    $BatteryUsed = $null

    if ($null -ne $Drive.starting_battery -and $null -ne $Drive.ending_battery) {
        $BatteryUsed = [int]$Drive.starting_battery - [int]$Drive.ending_battery
    }

    $Miles = $null
    if ($null -ne $Drive.odometer_distance) {
        $Miles = [math]::Round([double]$Drive.odometer_distance, 1)
    }

    $Energy = $null
    if ($null -ne $Drive.energy_used) {
        $Energy = [math]::Round([double]$Drive.energy_used, 2)
    }

    $Efficiency = $null
    if ($Miles -and $Miles -gt 0 -and $Energy -ne $null) {
        $Efficiency = [math]::Round(($Energy * 1000) / $Miles)
    }

    $Soundtrack = @(Get-SoundtrackForWindow -DriveStart $Start -DriveEnd $End -History $SpotifyHistory)

    return [PSCustomObject]@{
        id              = "$($Drive.started_at)-$($Drive.ended_at)"
        startedAt       = $Start.ToString("o")
        endedAt         = $End.ToString("o")
        dateLabel       = $Start.ToString("dddd, MMMM d")
        shortDateLabel  = $Start.ToString("ddd, MMM d")
        dateIso         = $Start.ToString("yyyy-MM-dd")
        dateNumeric     = $Start.ToString("M/d/yyyy")
        startTime       = $Start.ToString("h:mm tt")
        endTime         = $End.ToString("h:mm tt")
        startingLocation = (Get-FriendlyLocation -Location $Drive.starting_location)
        endingLocation   = (Get-FriendlyLocation -Location $Drive.ending_location)
        rawStartingLocation = $Drive.starting_location
        rawEndingLocation   = $Drive.ending_location
        startingLatitude = $Drive.starting_latitude
        startingLongitude = $Drive.starting_longitude
        endingLatitude   = $Drive.ending_latitude
        endingLongitude  = $Drive.ending_longitude
        tessieTag        = $Drive.tag
        driverProfile    = $Drive.driver_profile
        durationMinutes = $DurationMinutes
        miles           = $Miles
        startingBattery = $Drive.starting_battery
        endingBattery   = $Drive.ending_battery
        batteryUsed     = $BatteryUsed
        energyKWh       = $Energy
        efficiencyWhMi  = $Efficiency
        averageSpeed    = $Drive.average_speed
        maxSpeed        = $Drive.max_speed
        soundtrack      = $Soundtrack
        songCount       = $Soundtrack.Count
    }
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
    $History = @(Get-SpotifyHistory)

    $TopTracks = @(
        $History |
        Group-Object track, artist |
        Sort-Object Count -Descending |
        Select-Object -First 10 |
        ForEach-Object {
            $Example = $_.Group | Select-Object -First 1

            $ResolvedTrackId = Get-SpotifyRecordTrackId -Record $Example

            [PSCustomObject]@{
                track      = $Example.track
                artist     = $Example.artist
                plays      = $_.Count
                trackId    = $ResolvedTrackId
                albumImage = $Example.album_image
                spotifyUrl = $Example.spotify_url
            }
        }
    )

    $TopArtists = @(
        $History |
        Group-Object artist |
        Sort-Object Count -Descending |
        Select-Object -First 10 |
        ForEach-Object {
            [PSCustomObject]@{
                artist = $_.Name
                plays  = $_.Count
            }
        }
    )

    $Daily = @()

    for ($i = 13; $i -ge 0; $i--) {
        $Day = (Get-Date).Date.AddDays(-$i)
        $Next = $Day.AddDays(1)
        $Count = 0

        foreach ($Record in $History) {
            try {
                $Played = [DateTimeOffset]::Parse($Record.played_at).LocalDateTime
                if ($Played -ge $Day -and $Played -lt $Next) {
                    $Count++
                }
            }
            catch {}
        }

        $Daily += [PSCustomObject]@{
            date  = $Day.ToString("yyyy-MM-dd")
            label = $Day.ToString("ddd")
            count = $Count
        }
    }

    return [PSCustomObject]@{
        totalPlays = $History.Count
        topTracks  = $TopTracks
        topArtists = $TopArtists
        daily      = $Daily
    }
}

function Get-DriveStats {
    $Drives = @(Get-RecentDrives -Days 30)

    $TotalMiles = 0.0
    $TotalEnergy = 0.0
    $TotalBattery = 0
    $SongCount = 0

    foreach ($Drive in $Drives) {
        if ($Drive.miles -ne $null) { $TotalMiles += [double]$Drive.miles }
        if ($Drive.energyKWh -ne $null) { $TotalEnergy += [double]$Drive.energyKWh }
        if ($Drive.batteryUsed -ne $null) { $TotalBattery += [int]$Drive.batteryUsed }
        $SongCount += [int]$Drive.songCount
    }

    $AverageEfficiency = $null

    if ($TotalMiles -gt 0 -and $TotalEnergy -gt 0) {
        $AverageEfficiency = [math]::Round(($TotalEnergy * 1000) / $TotalMiles)
    }

    return [PSCustomObject]@{
        periodDays       = 30
        driveCount       = $Drives.Count
        totalMiles       = [math]::Round($TotalMiles, 1)
        totalEnergyKWh   = [math]::Round($TotalEnergy, 2)
        totalBatteryUsed = $TotalBattery
        averageWhMi      = $AverageEfficiency
        soundtrackSongs  = $SongCount
    }
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

    if (-not $Drive.soundtrack -or $Drive.soundtrack.Count -eq 0) {
        throw "No archived Spotify tracks overlap this drive."
    }

    $TrackUris = @()

    foreach ($Track in $Drive.soundtrack) {
        if ($Track.trackUri -and ($TrackUris -notcontains $Track.trackUri)) {
            $TrackUris += $Track.trackUri
        }
    }

    if ($TrackUris.Count -eq 0) {
        throw "No Spotify track IDs were available for this drive."
    }

    $Token = Get-SpotifyAccessToken
    $Headers = @{
        Authorization = "Bearer $Token"
        "Content-Type" = "application/json"
    }

    $PlaylistName = "DriveOS - $($Drive.shortDateLabel) $($Drive.startTime)"
    $Description = "Drive soundtrack captured by DriveOS."

    $CreateBody = @{
        name        = $PlaylistName
        public      = $false
        description = $Description
    } | ConvertTo-Json -Compress

    $Playlist = Invoke-RestMethod `
        -Uri "https://api.spotify.com/v1/me/playlists" `
        -Headers $Headers `
        -Method Post `
        -Body $CreateBody

    $PlaylistId = $Playlist.id

    for ($i = 0; $i -lt $TrackUris.Count; $i += 100) {
        $Last = [math]::Min($i + 99, $TrackUris.Count - 1)
        $Chunk = @($TrackUris[$i..$Last])

        $ItemsBody = @{
            uris = $Chunk
        } | ConvertTo-Json -Depth 5 -Compress

        $null = Invoke-RestMethod `
            -Uri "https://api.spotify.com/v1/playlists/$PlaylistId/items" `
            -Headers $Headers `
            -Method Post `
            -Body $ItemsBody
    }

    return [PSCustomObject]@{
        success      = $true
        playlistId   = $PlaylistId
        playlistName = $PlaylistName
        trackCount   = $TrackUris.Count
        url          = if ($Playlist.external_urls.spotify) { $Playlist.external_urls.spotify } else { $null }
    }
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

    return [PSCustomObject]@{
        driveOS       = "online"
        tessie        = $VehicleOk
        spotify       = $SpotifyOk
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

                "/api/places/alias" {
                    if (-not $BodyText) { throw "Request body was empty." }
                    $Body = $BodyText | ConvertFrom-Json
                    Send-Json -Stream $Stream -Object (Set-PlaceAlias -Location $Body.location -Label $Body.label)
                    return
                }

                "/api/charging/settings" {
                    if (-not $BodyText) { throw "Request body was empty." }
                    $Body = $BodyText | ConvertFrom-Json
                    Send-Json -Stream $Stream -Object (Set-ChargingSettings -ElectricityRateCents $Body.electricityRateCents)
                    return
                }

                "/api/drive/map" {
                    if (-not $BodyText) {
                        throw "Request body was empty."
                    }

                    $Body = $BodyText | ConvertFrom-Json

                    if (-not $Body.driveId) {
                        throw "driveId is required."
                    }

                    Send-Json -Stream $Stream -Object (Get-DriveMapData -DriveId $Body.driveId)
                    return
                }

                "/api/playlist/create" {
                    if (-not $BodyText) {
                        throw "Request body was empty."
                    }

                    $Body = $BodyText | ConvertFrom-Json

                    if (-not $Body.driveId) {
                        throw "driveId is required."
                    }

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
        $Code = 500
        $Text = "Internal Server Error"
        $PublicMessage = "DriveOS request failed."

        if ($Message -like "*Spotify token file not found*") {
            $Code = 401
            $Text = "Unauthorized"
            $PublicMessage = "Spotify authorization is required on this computer."
        }
        elseif ($Message -like "*playlist-modify-private*") {
            $Code = 403
            $Text = "Forbidden"
            $PublicMessage = "Spotify playlist permission is not available. Reauthorize Spotify for DriveOS."
        }
        elseif ($Message -like "*driveId is required*") {
            $Code = 400
            $Text = "Bad Request"
            $PublicMessage = "driveId is required."
        }
        elseif ($Message -like "*Request body was empty*") {
            $Code = 400
            $Text = "Bad Request"
            $PublicMessage = "Request body was empty."
        }

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
