param(
    [int]$ParentPid = 0,
    [Int64]$ParentStartTicks = 0,
    [switch]$RefreshMusicCatalog
)

$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "src\Configuration\DriveOS.Configuration.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Sqlite.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Turso.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Repositories\DriveOS.Repository.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Tessie\DriveOS.Tessie.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
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
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.ShareCards.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.Assistant.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Http\DriveOS.Http.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebAuth.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebSession.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebRequest.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.SecretProtection.psm1") -Force

# ============================================================
# DriveOS 3.2
# Windows PowerShell 5.1 compatible
#
# DriveOS.exe -> authenticated localhost backend -> Tessie / Spotify
# Secrets are never exposed to the browser.
# ============================================================

$RuntimeConfig = Get-DriveOSRuntimeConfiguration -AppRoot $PSScriptRoot
$WebAuthConfig = $null

if ($RuntimeConfig.IsWeb) {
    $WebAuthConfig = Get-DriveOSWebAuthConfiguration `
        -PublicUrl $RuntimeConfig.PublicUrl
}

$HostAddress = $RuntimeConfig.ListenAddress
$Port = $RuntimeConfig.Port
$ExpectedHostHeader = "${HostAddress}:$Port"
$TailscaleHostPattern = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)+\.ts\.net(?::443)?$"
$MaxRequestLineBytes = 8192
$MaxHeaderBytes = 32768
$MaxBodyBytes = 65536
$SessionToken = $env:DRIVEOS_SESSION_TOKEN
$DataDirectory = $RuntimeConfig.DataDirectory
$ServerLogFile = Join-Path $DataDirectory "driveos-server.log"

$WebRoot = Join-Path $PSScriptRoot "web"
$SpotifyTokenFile = Join-Path $DataDirectory "spotify-token.json"
$SpotifyOAuthStateFile = Join-Path $DataDirectory "spotify-oauth-state.json"
$SpotifyHistoryFile = Join-Path $DataDirectory "spotify-history.jsonl"
$SpotifyCatalogCacheFile = Join-Path $DataDirectory "spotify-catalog-cache.json"
$WifeModeMusicFile = Join-Path $DataDirectory "wife-mode-music.json"
$FullModeDriveCacheFile = Join-Path $DataDirectory "full-mode-drive-cache.json"
$PlaceAliasesFile = Join-Path $DataDirectory "place-aliases.json"
$FoursquareConfigFile = Join-Path $DataDirectory "foursquare-config.json"
$FoursquareCacheFile = Join-Path $DataDirectory "foursquare-place-cache.json"
$FoursquareUsageFile = Join-Path $DataDirectory "foursquare-usage.json"
$ChargingSettingsFile = Join-Path $DataDirectory "charging-settings.json"
$FoursquareDailyLimit = 10
$FoursquareMonthlyLimit = 250
$script:FoursquareApiKeyForRedaction = $null

# Expensive Tessie-derived data is reused briefly across the dashboard's
# back-to-back API calls. This is process-local only and disappears on restart.
$script:DriveDataCache = @{
    rawDrives365 = $null
    rawDrives365ExpiresAt = [DateTimeOffset]::MinValue
    drives365 = $null
    drives365ExpiresAt = [DateTimeOffset]::MinValue
    dashboardDrives = $null
    dashboardDrivesExpiresAt = [DateTimeOffset]::MinValue
    wifeDrives = $null
    wifeDrivesExpiresAt = [DateTimeOffset]::MinValue
    charges365 = $null
    charges365ExpiresAt = [DateTimeOffset]::MinValue
}
$DriveDataCacheTtlSeconds = 300

# Process-local read-through caches. Turso/local storage remains the durable
# source of truth, but repeated dashboard requests should not reopen the same
# state on every endpoint.
$script:SpotifyTokenCacheMemory = $null
$script:SpotifyHistoryCache = $null
$script:SpotifyHistoryCacheExpiresAt = [DateTimeOffset]::MinValue
$script:WifeModeMusicRecordsMemory = @()
$script:WifeModeMusicRecordsLoaded = $false
$script:FullModeDriveRecordsMemory = @()
$script:FullModeDriveRecordsLoaded = $false
$script:MusicStatsCache = $null
$script:MusicStatsCacheExpiresAt = [DateTimeOffset]::MinValue
$script:SpotifyCatalogCacheMemory = $null
$script:SpotifyCatalogCacheLoaded = $false
$script:PlaceAliasEntriesCache = @()
$script:PlaceAliasEntriesLoaded = $false
$script:ChargingSettingsCache = $null
$script:FoursquareCacheEntriesMemory = @()
$script:FoursquareCacheEntriesLoaded = $false
$script:FoursquareUsageRecordMemory = $null
$script:FoursquareUsageRecordLoaded = $false
$script:VehicleSummaryCache = $null
$script:VehicleSummaryCacheExpiresAt = [DateTimeOffset]::MinValue
$VehicleSummaryCacheTtlSeconds = 15

$Repository = New-DriveOSRepository -DataDirectory $DataDirectory -AppRoot $PSScriptRoot
$MaintenanceMode = $RefreshMusicCatalog

if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

if ($Repository.Provider -eq "SQLite") {
    Initialize-DriveOSSqlite -Repository $Repository
}
elseif ($Repository.Provider -eq "Turso") {
    Initialize-DriveOSTurso -Repository $Repository
}

if (-not $MaintenanceMode -and -not $env:TESSIE_TOKEN) {
    throw "TESSIE_TOKEN is not available to DriveOS."
}

if (-not $MaintenanceMode -and -not $env:SPOTIFY_CLIENT_ID) {
    throw "SPOTIFY_CLIENT_ID is not available to DriveOS."
}


if (
    -not $MaintenanceMode -and
    $RuntimeConfig.IsDesktop -and
    ($ParentPid -le 0 -or $ParentStartTicks -le 0)
) {
    throw "DriveOS server requires a validated desktop parent process."
}

if (
    -not $MaintenanceMode -and
    $RuntimeConfig.IsDesktop -and
    (-not $SessionToken -or $SessionToken -notmatch "^[0-9a-f]{64}$")
) {
    throw "DriveOS local-session credential is missing or invalid."
}

function Write-DriveOSServerLog {
    param([string]$Message)

    try {
        $SafeMessage = "$Message"

        foreach ($Secret in @(
            $env:TESSIE_TOKEN,
            $env:SPOTIFY_CLIENT_ID,
            $env:TURSO_AUTH_TOKEN,
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
        $LogLine = "$Stamp  $SafeMessage"
        $LogLine | Add-Content -Path $ServerLogFile -Encoding UTF8

        if ($RuntimeConfig.IsWeb) {
            Write-Host $LogLine
        }
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

function Test-DriveOSClientDisconnectError {
    param([System.Exception]$Exception)

    $Current = $Exception

    while ($Current) {
        $Message = "$($Current.Message)"

        if (
            $Current -is [System.IO.IOException] -and
            $Message -match '(?i)broken pipe|transport connection|connection.*closed|connection.*reset|forcibly closed'
        ) {
            return $true
        }

        if (
            $Current -is [System.Net.Sockets.SocketException] -and
            $Message -match '(?i)broken pipe|connection.*closed|connection.*reset|forcibly closed'
        ) {
            return $true
        }

        $Current = $Current.InnerException
    }

    return $false
}

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
        [byte[]]$Body = @(),
        [hashtable]$AdditionalHeaders = @{}
    )

    $ExtraHeaderText = ""

    foreach ($Name in $AdditionalHeaders.Keys) {
        $HeaderName = "$Name"
        $HeaderValue = "$($AdditionalHeaders[$Name])"

        if ($HeaderName -notmatch '^[A-Za-z0-9-]+$') {
            throw "Invalid HTTP response header name."
        }

        if (
            $HeaderValue.Contains("`r") -or
            $HeaderValue.Contains("`n")
        ) {
            throw "Invalid HTTP response header value."
        }

        $ExtraHeaderText += "$HeaderName`: $HeaderValue`r`n"
    }

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
        $ExtraHeaderText +
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
        [string]$StatusText = "OK",
        [hashtable]$AdditionalHeaders = @{}
    )

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonSafe $Object))

    Send-HttpResponse `
        -Stream $Stream `
        -StatusCode $StatusCode `
        -StatusText $StatusText `
        -ContentType "application/json; charset=utf-8" `
        -Body $Bytes `
        -AdditionalHeaders $AdditionalHeaders
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

    if (-not $EncryptedToken) {
        return $null
    }

    return Unprotect-DriveOSSecret `
        -ProtectedText $EncryptedToken `
        -Mode $RuntimeConfig.Mode `
        -EncryptionKey $(if ($WebAuthConfig) {
            $WebAuthConfig.EncryptionKey
        } else {
            $null
        })
}

function Protect-Token {
    param([string]$Token)

    return Protect-DriveOSSecret `
        -PlainText $Token `
        -Mode $RuntimeConfig.Mode `
        -EncryptionKey $(if ($WebAuthConfig) {
            $WebAuthConfig.EncryptionKey
        } else {
            $null
        })
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

    if ($RuntimeConfig.IsWeb -and $Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-token" `
            -Value $TokenCache
        $script:SpotifyTokenCacheMemory = $TokenCache
        return
    }

    Write-DriveOSJson -Path $SpotifyTokenFile -Value $TokenCache
    $script:SpotifyTokenCacheMemory = $TokenCache
}

function Get-SpotifyTokenCache {
    # The hosted app can safely keep its Turso-backed token in process memory.
    # Desktop authorization is completed by the separate Connect-Spotify.ps1
    # process, which overwrites spotify-token.json while the backend is still
    # running. Always reread that local file so the backend immediately sees
    # newly authorized credentials instead of retaining a stale token.
    if ($RuntimeConfig.IsWeb) {
        if ($null -ne $script:SpotifyTokenCacheMemory) {
            return $script:SpotifyTokenCacheMemory
        }

        if ($Repository.Provider -eq "Turso") {
            $Stored = Get-DriveOSTursoState `
                -Repository $Repository `
                -Key "spotify-token"

            if (-not $Stored) {
                throw "Spotify authorization is not configured."
            }

            $script:SpotifyTokenCacheMemory = $Stored
            return $Stored
        }
    }

    if (-not (Test-Path $SpotifyTokenFile -PathType Leaf)) {
        throw "Spotify token file not found. Run Connect-Spotify.ps1."
    }

    $Stored = Read-DriveOSJson -Path $SpotifyTokenFile
    $script:SpotifyTokenCacheMemory = $Stored
    return $Stored
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

function Set-SpotifyHistoryMemoryCache {
    param([object[]]$Records = @())

    $script:SpotifyHistoryCache = @($Records)
    $script:SpotifyHistoryCacheExpiresAt = [DateTimeOffset]::UtcNow.AddSeconds($DriveDataCacheTtlSeconds)

    # Aggregate music statistics depend on the listening archive.
    $script:MusicStatsCache = $null
    $script:MusicStatsCacheExpiresAt = [DateTimeOffset]::MinValue
}

function Clear-SpotifyHistoryMemoryCache {
    $script:SpotifyHistoryCache = $null
    $script:SpotifyHistoryCacheExpiresAt = [DateTimeOffset]::MinValue
    $script:MusicStatsCache = $null
    $script:MusicStatsCacheExpiresAt = [DateTimeOffset]::MinValue
}

function ConvertTo-ListeningMatchText {
    param([string]$Value)

    if (-not $Value) { return "" }

    return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
}

function Get-ListeningRecordSource {
    param($Record)

    if ($Record -and $Record.PSObject.Properties['source'] -and $Record.source) {
        return "$($Record.source)".ToLowerInvariant()
    }

    if ($Record -and $Record.id -and "$($Record.id)".StartsWith(
        "lastfm|",
        [StringComparison]::OrdinalIgnoreCase
    )) {
        return "lastfm"
    }

    return "spotify"
}

function Test-CrossProviderListeningDuplicate {
    param(
        [Parameter(Mandatory=$true)]$Candidate,
        [Parameter(Mandatory=$true)]$ExistingRecord
    )

    $CandidateSource = Get-ListeningRecordSource -Record $Candidate
    $ExistingSource = Get-ListeningRecordSource -Record $ExistingRecord

    # Only collapse the old Last.fm/Spotify overlap. Never collapse two Spotify
    # plays, so genuine repeat listens remain intact.
    if ($CandidateSource -eq $ExistingSource) {
        return $false
    }

    if (
        @($CandidateSource, $ExistingSource) -notcontains "spotify" -or
        @($CandidateSource, $ExistingSource) -notcontains "lastfm"
    ) {
        return $false
    }

    $CandidateTrack = ConvertTo-ListeningMatchText "$($Candidate.track)"
    $ExistingTrack = ConvertTo-ListeningMatchText "$($ExistingRecord.track)"

    if (-not $CandidateTrack -or $CandidateTrack -ne $ExistingTrack) {
        return $false
    }

    $CandidateArtist = ConvertTo-ListeningMatchText "$($Candidate.artist)"
    $ExistingArtist = ConvertTo-ListeningMatchText "$($ExistingRecord.artist)"

    if (
        $CandidateArtist -and
        $ExistingArtist -and
        $CandidateArtist -ne $ExistingArtist -and
        -not $CandidateArtist.Contains($ExistingArtist) -and
        -not $ExistingArtist.Contains($CandidateArtist)
    ) {
        return $false
    }

    try {
        $CandidateSeconds = [DateTimeOffset]::Parse(
            "$($Candidate.played_at)"
        ).ToUnixTimeSeconds()

        $ExistingSeconds = [DateTimeOffset]::Parse(
            "$($ExistingRecord.played_at)"
        ).ToUnixTimeSeconds()
    }
    catch {
        return $false
    }

    # Last.fm and Spotify can timestamp the same listen at different points
    # in the playback lifecycle. Use the track duration plus a small buffer,
    # matching the cross-provider rule DriveOS used successfully before the
    # Last.fm active integration was retired.
    $DurationSeconds = 240

    foreach ($Record in @($Candidate, $ExistingRecord)) {
        if (
            $Record.PSObject.Properties['duration_ms'] -and
            [long]$Record.duration_ms -gt 0
        ) {
            $DurationSeconds = [Math]::Max(
                $DurationSeconds,
                [Math]::Ceiling([double]$Record.duration_ms / 1000)
            )
        }
    }

    $WindowSeconds = [Math]::Min(
        [Math]::Max($DurationSeconds + 90, 180),
        720
    )

    return [Math]::Abs($CandidateSeconds - $ExistingSeconds) -le $WindowSeconds
}

function Remove-CrossProviderListeningDuplicates {
    param([object[]]$Records = @())

    $Kept = New-Object Collections.ArrayList

    foreach ($Record in @($Records | Sort-Object {
        try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks }
        catch { 0 }
    })) {
        $DuplicateIndex = -1

        for ($i = 0; $i -lt $Kept.Count; $i++) {
            if (Test-CrossProviderListeningDuplicate `
                -Candidate $Record `
                -ExistingRecord $Kept[$i]) {
                $DuplicateIndex = $i
                break
            }
        }

        if ($DuplicateIndex -lt 0) {
            [void]$Kept.Add($Record)
            continue
        }

        # Prefer the Spotify row when both providers represent the same listen.
        # The old Last.fm row remains safely stored in Turso; it is simply not
        # exposed twice through DriveOS.
        if ((Get-ListeningRecordSource -Record $Record) -eq "spotify") {
            $Kept[$DuplicateIndex] = $Record
        }
    }

    return @($Kept)
}

function Get-SpotifyListeningIdentity {
    param($Record)

    if (
        (Get-ListeningRecordSource -Record $Record) -ne "spotify" -or
        -not $Record.track_id -or
        -not $Record.played_at
    ) {
        return $null
    }

    try {
        $PlayedMilliseconds = [DateTimeOffset]::Parse(
            "$($Record.played_at)"
        ).ToUnixTimeMilliseconds()
    }
    catch {
        return $null
    }

    return "$($Record.track_id)|$PlayedMilliseconds"
}

function Remove-ExactSpotifyListeningDuplicates {
    param([object[]]$Records = @())

    $Seen = @{}
    $Kept = New-Object Collections.ArrayList

    foreach ($Record in @($Records)) {
        $Identity = Get-SpotifyListeningIdentity -Record $Record

        if ($Identity -and $Seen.ContainsKey($Identity)) {
            continue
        }

        if ($Identity) {
            $Seen[$Identity] = $true
        }

        [void]$Kept.Add($Record)
    }

    return @($Kept)
}

function Save-SpotifyHistory {
    param($Items)

    if (-not $Items) { return 0 }

    $ExistingIds = @{}
    $ExistingSpotifyPlays = @{}
    $UpdatedHistory = New-Object Collections.ArrayList

    foreach ($Record in @(Get-SpotifyHistory)) {
        if ($Record.id) { $ExistingIds[$Record.id] = $true }
        $ExistingIdentity = Get-SpotifyListeningIdentity -Record $Record
        if ($ExistingIdentity) { $ExistingSpotifyPlays[$ExistingIdentity] = $true }
        [void]$UpdatedHistory.Add($Record)
    }

    $NewCount = 0

    foreach ($Item in $Items) {
        $HistoryRecord = ConvertTo-DriveOSSpotifyPlay -Item $Item
        $RecordId = "$($HistoryRecord.id)"
        $SpotifyIdentity = Get-SpotifyListeningIdentity -Record $HistoryRecord

        if (
            $ExistingIds.ContainsKey($RecordId) -or
            ($SpotifyIdentity -and $ExistingSpotifyPlays.ContainsKey($SpotifyIdentity))
        ) {
            continue
        }

        $CrossProviderDuplicate = $false

        foreach ($ExistingRecord in @($UpdatedHistory)) {
            if (Test-CrossProviderListeningDuplicate `
                -Candidate $HistoryRecord `
                -ExistingRecord $ExistingRecord) {
                $CrossProviderDuplicate = $true
                break
            }
        }

        if ($CrossProviderDuplicate) {
            continue
        }

        Add-DriveOSListeningHistoryRecord -Repository $Repository -Record $HistoryRecord

        [void]$UpdatedHistory.Add($HistoryRecord)
        $ExistingIds[$RecordId] = $true
        if ($SpotifyIdentity) { $ExistingSpotifyPlays[$SpotifyIdentity] = $true }
        $NewCount++
    }

    if ($NewCount -gt 0) {
        Set-SpotifyHistoryMemoryCache -Records @($UpdatedHistory)
        $script:DriveDataCache.drives365 = $null
        $script:DriveDataCache.drives365ExpiresAt = [DateTimeOffset]::MinValue
        $script:DriveDataCache.dashboardDrives = $null
        $script:DriveDataCache.dashboardDrivesExpiresAt = [DateTimeOffset]::MinValue
        $script:DriveDataCache.wifeDrives = $null
        $script:DriveDataCache.wifeDrivesExpiresAt = [DateTimeOffset]::MinValue
    }

    return $NewCount
}

function Get-SpotifyHistory {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $null -ne $script:SpotifyHistoryCache -and
        $script:SpotifyHistoryCacheExpiresAt -gt $Now
    ) {
        return @($script:SpotifyHistoryCache)
    }

    $Records = @()

    foreach ($Record in @(Get-DriveOSListeningHistory -Repository $Repository)) {
        # v0.2 did not store track_uri, but track_id is sufficient.
        if (-not $Record.track_uri -and $Record.track_id) {
            $Record | Add-Member -NotePropertyName track_uri -NotePropertyValue "spotify:track:$($Record.track_id)" -Force
        }
        $Records += $Record
    }

    # Historical Last.fm rows are intentionally preserved in Turso. During the
    # cutover to Spotify-only ingestion, a small number of the same listens were
    # also archived as Spotify rows. Collapse only those cross-provider twins
    # for every DriveOS consumer while leaving the durable history untouched.
    $Records = @(Remove-ExactSpotifyListeningDuplicates -Records $Records)
    $Records = @(Remove-CrossProviderListeningDuplicates -Records $Records)

    Set-SpotifyHistoryMemoryCache -Records $Records
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

    $TokenStored = if (
        $RuntimeConfig.IsWeb -and
        $Repository.Provider -eq "Turso"
    ) {
        $null -ne (
            Get-DriveOSTursoState `
                -Repository $Repository `
                -Key "spotify-token"
        )
    }
    else {
        Test-Path $SpotifyTokenFile -PathType Leaf
    }

    return [PSCustomObject]@{
        authorized = $Authorized
        tokenFile  = [bool]$TokenStored
    }
}

function ConvertTo-SpotifyBase64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).
        TrimEnd('=').
        Replace('+', '-').
        Replace('/', '_')
}

function Get-DriveOSQueryParameters {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Target
    )

    $Uri = [Uri]("https://driveos.invalid$Target")
    $Result = @{}

    foreach ($Pair in $Uri.Query.TrimStart("?").Split("&")) {
        if (-not $Pair) {
            continue
        }

        $Parts = $Pair.Split("=", 2)
        $Key = [Uri]::UnescapeDataString(
            $Parts[0].Replace("+", " ")
        )

        $Value = if ($Parts.Count -gt 1) {
            [Uri]::UnescapeDataString(
                $Parts[1].Replace("+", " ")
            )
        }
        else {
            ""
        }

        if ($Result.ContainsKey($Key)) {
            throw "Duplicate query parameter was rejected."
        }

        $Result[$Key] = $Value
    }

    return $Result
}

function Start-SpotifyWebAuthorization {
    $RedirectUri = "$($RuntimeConfig.PublicUrl)/auth/spotify/callback"

    $Scopes = @(
        "user-read-recently-played"
        "user-read-playback-state"
        "user-read-currently-playing"
        "playlist-modify-private"
    ) -join " "

    $VerifierBytes = New-Object byte[] 64
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($VerifierBytes)
    }
    finally {
        $Random.Dispose()
    }

    $CodeVerifier = ConvertTo-SpotifyBase64Url -Bytes $VerifierBytes

    $Sha256 = [Security.Cryptography.SHA256]::Create()

    try {
        $ChallengeBytes = $Sha256.ComputeHash(
            [Text.Encoding]::ASCII.GetBytes($CodeVerifier)
        )
    }
    finally {
        $Sha256.Dispose()
    }

    $CodeChallenge = ConvertTo-SpotifyBase64Url `
        -Bytes $ChallengeBytes

    $StateBytes = New-Object byte[] 32
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($StateBytes)
    }
    finally {
        $Random.Dispose()
    }

    $State = ConvertTo-SpotifyBase64Url -Bytes $StateBytes

    $PendingAuthorization = [PSCustomObject]@{
        state = $State
        verifier = Protect-Token $CodeVerifier
        redirectUri = $RedirectUri
        expiresAt = [DateTimeOffset]::UtcNow.
            AddMinutes(10).
            ToString("o")
    }

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-oauth-state" `
            -Value $PendingAuthorization
    }
    else {
        Write-DriveOSJson `
            -Path $SpotifyOAuthStateFile `
            -Value $PendingAuthorization
    }

    $AuthUrl =
        "https://accounts.spotify.com/authorize" +
        "?client_id=$([Uri]::EscapeDataString($env:SPOTIFY_CLIENT_ID))" +
        "&response_type=code" +
        "&redirect_uri=$([Uri]::EscapeDataString($RedirectUri))" +
        "&scope=$([Uri]::EscapeDataString($Scopes))" +
        "&code_challenge_method=S256" +
        "&code_challenge=$([Uri]::EscapeDataString($CodeChallenge))" +
        "&state=$([Uri]::EscapeDataString($State))"

    return [PSCustomObject]@{
        started = $true
        authorizationUrl = $AuthUrl
    }
}

function Complete-SpotifyWebAuthorization {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Target
    )

    $Pending = if ($Repository.Provider -eq "Turso") {
        Get-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-oauth-state"
    }
    elseif (Test-Path $SpotifyOAuthStateFile -PathType Leaf) {
        Read-DriveOSJson -Path $SpotifyOAuthStateFile
    }
    else {
        $null
    }

    if (-not $Pending) {
        throw "Spotify authorization state was not found or has expired."
    }

    $ExpiresAt = [DateTimeOffset]::Parse(
        "$($Pending.expiresAt)"
    )

    if ([DateTimeOffset]::UtcNow -ge $ExpiresAt) {
        if ($Repository.Provider -eq "Turso") {
            Remove-DriveOSTursoState `
                -Repository $Repository `
                -Key "spotify-oauth-state"
        }
        else {
            Remove-Item $SpotifyOAuthStateFile -Force -ErrorAction SilentlyContinue
        }

        throw "Spotify authorization state has expired."
    }

    $Query = Get-DriveOSQueryParameters -Target $Target

    if ($Query["error"]) {
        throw "Spotify authorization failed: $($Query["error"])"
    }

    if (-not $Query["code"] -or -not $Query["state"]) {
        throw "Spotify authorization callback was incomplete."
    }

    if (-not (
        Test-FixedTimeStringEquals `
            "$($Query["state"])" `
            "$($Pending.state)"
    )) {
        throw "Spotify authorization state did not match."
    }

    $CodeVerifier = Unprotect-Token "$($Pending.verifier)"
    $RedirectUri = "$($Pending.redirectUri)"

    $TokenResponse = Invoke-RestMethod `
        -Uri "https://accounts.spotify.com/api/token" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{
            client_id     = $env:SPOTIFY_CLIENT_ID
            grant_type    = "authorization_code"
            code          = $Query["code"]
            redirect_uri  = $RedirectUri
            code_verifier = $CodeVerifier
        }

    if (
        -not $TokenResponse.access_token -or
        -not $TokenResponse.refresh_token
    ) {
        throw "Spotify token response was incomplete."
    }

    Save-SpotifyTokenCache `
        -AccessToken $TokenResponse.access_token `
        -RefreshToken $TokenResponse.refresh_token `
        -ExpiresIn ([int]$TokenResponse.expires_in) `
        -Scope "$($TokenResponse.scope)"

    if ($Repository.Provider -eq "Turso") {
        Remove-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-oauth-state"
    }
    else {
        Remove-Item `
            $SpotifyOAuthStateFile `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

function Start-SpotifyAuthorization {
    if ($RuntimeConfig.IsWeb) {
        return Start-SpotifyWebAuthorization
    }

    $Script = Join-Path $PSScriptRoot "Connect-Spotify.ps1"

    if (-not (Test-Path $Script -PathType Leaf)) {
        throw "Spotify authorization script is missing."
    }

    # Desktop mode preserves the existing separate Windows authorization flow.
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

function Get-FoursquareConfiguration {
    if ($RuntimeConfig.IsWeb -and $env:FOURSQUARE_API_KEY) {
        $ApiKey = "$($env:FOURSQUARE_API_KEY)".Trim()
        $script:FoursquareApiKeyForRedaction = $ApiKey
        return [PSCustomObject]@{ apiKey = $ApiKey }
    }

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
    if ($script:FoursquareUsageRecordLoaded) {
        return $script:FoursquareUsageRecordMemory
    }

    $Record = $null

    if ($Repository.Provider -eq "Turso") {
        try {
            $Record = Get-DriveOSTursoState `
                -Repository $Repository `
                -Key "foursquare-usage"
        }
        catch {}
    }
    elseif (Test-Path $FoursquareUsageFile -PathType Leaf) {
        try { $Record = Read-DriveOSJson -Path $FoursquareUsageFile } catch {}
    }

    $script:FoursquareUsageRecordMemory = $Record
    $script:FoursquareUsageRecordLoaded = $true
    return $Record
}

function Save-FoursquareUsageRecord {
    param([Parameter(Mandatory=$true)]$Record)

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "foursquare-usage" `
            -Value $Record
    }
    else {
        Write-DriveOSJson -Path $FoursquareUsageFile -Value $Record
    }

    $script:FoursquareUsageRecordMemory = $Record
    $script:FoursquareUsageRecordLoaded = $true
}

function Get-FoursquareCacheEntries {
    if ($script:FoursquareCacheEntriesLoaded) {
        return @($script:FoursquareCacheEntriesMemory)
    }

    $Entries = @()

    try {
        $Record = if ($Repository.Provider -eq "Turso") {
            Get-DriveOSTursoState `
                -Repository $Repository `
                -Key "foursquare-cache"
        }
        elseif (Test-Path $FoursquareCacheFile -PathType Leaf) {
            Read-DriveOSJson -Path $FoursquareCacheFile
        }
        else {
            $null
        }

        if ($Record -and $Record.PSObject.Properties['entries']) {
            $Entries = @($Record.entries)
        }
    }
    catch {}

    $script:FoursquareCacheEntriesMemory = @($Entries)
    $script:FoursquareCacheEntriesLoaded = $true
    return @($Entries)
}

function Save-FoursquareCacheEntries {
    param([object[]]$Entries)

    $Record = [PSCustomObject]@{
        version = 1
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        entries = @($Entries)
    }

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "foursquare-cache" `
            -Value $Record
    }
    else {
        Write-DriveOSJson -Path $FoursquareCacheFile -Value $Record
    }

    $script:FoursquareCacheEntriesMemory = @($Entries)
    $script:FoursquareCacheEntriesLoaded = $true

    # Converted drives contain friendly location names, so refresh that layer
    # only when the persisted place-resolution data changes.
    $script:DriveDataCache.drives365 = $null
    $script:DriveDataCache.drives365ExpiresAt = [DateTimeOffset]::MinValue
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

    $Record = [PSCustomObject]@{
        version = 1
        day = $Usage.day
        dayCount = [int]$Usage.dayCount
        month = $Usage.month
        monthCount = [int]$Usage.monthCount
        lastError = if ($Message) { $Message } else { $null }
        lastErrorAt = if ($Message) { [DateTimeOffset]::UtcNow.ToString('o') } else { $null }
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }

    Save-FoursquareUsageRecord -Record $Record
}

function Register-FoursquareApiCall {
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage (Get-FoursquareUsageRecord) `
        -DailyLimit $FoursquareDailyLimit -MonthlyLimit $FoursquareMonthlyLimit

    if (-not $Usage.canCall) { return $false }

    $Record = [PSCustomObject]@{
        version = 1
        day = $Usage.day
        dayCount = ([int]$Usage.dayCount + 1)
        month = $Usage.month
        monthCount = ([int]$Usage.monthCount + 1)
        lastError = $null
        lastErrorAt = $null
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }

    Save-FoursquareUsageRecord -Record $Record
    return $true
}

function Start-FoursquareConfiguration {
    if ($RuntimeConfig.IsWeb) {
        throw "Configure FOURSQUARE_API_KEY in the hosting environment."
    }

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
    param(
        [string]$Location,
        $Latitude = $null,
        $Longitude = $null,
        $CacheMap = $null
    )

    $Key = Get-DriveOSPlaceCacheKey -Location $Location -Latitude $Latitude -Longitude $Longitude
    if (-not $Key) { return $null }

    $Map = if ($null -ne $CacheMap) { $CacheMap } else { Get-FoursquareCacheMap }
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

function ConvertTo-DriveOSDisplayTime {
    param(
        [Parameter(Mandatory=$true)]
        [DateTimeOffset]$Value
    )

    if ($RuntimeConfig.IsWeb) {
        $UtcValue = $Value.ToUniversalTime()
        $Year = $UtcValue.Year

        $MarchFirst = [DateTimeOffset]::new(
            $Year, 3, 1, 0, 0, 0, [TimeSpan]::Zero
        )

        $MarchDaysToSunday =
            (7 - [int]$MarchFirst.DayOfWeek) % 7

        $DstStartUtc = $MarchFirst.AddDays(
            $MarchDaysToSunday + 7
        ).AddHours(8)

        $NovemberFirst = [DateTimeOffset]::new(
            $Year, 11, 1, 0, 0, 0, [TimeSpan]::Zero
        )

        $NovemberDaysToSunday =
            (7 - [int]$NovemberFirst.DayOfWeek) % 7

        $DstEndUtc = $NovemberFirst.AddDays(
            $NovemberDaysToSunday
        ).AddHours(7)

        $Offset = if (
            $UtcValue -ge $DstStartUtc -and
            $UtcValue -lt $DstEndUtc
        ) {
            [TimeSpan]::FromHours(-5)
        }
        else {
            [TimeSpan]::FromHours(-6)
        }

        return $UtcValue.ToOffset($Offset)
    }

    return $Value.ToLocalTime()
}
function ConvertTo-PublicListeningPlay {
    param([Parameter(Mandatory=$true)]$Record)

    $Played = ConvertTo-DriveOSDisplayTime `
        -Value ([DateTimeOffset]::Parse("$($Record.played_at)"))
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
    # Spotify is the only active listening source. The hosted DriveOS instance
    # is responsible for polling Spotify and writing new plays into Turso.
    #
    # Desktop DriveOS reads that same shared archive but does not write new
    # listening records. This keeps desktop and web on one source of truth and
    # avoids Windows PowerShell/Turso write failures during dashboard refresh.
    $SpotifyAdded = 0

    if ($RuntimeConfig.IsWeb) {
        $Items = @(Get-SpotifyRecent -Limit 50)
        $SpotifyAdded = Save-SpotifyHistory $Items
    }

    $History = @(Get-SpotifyHistory | Sort-Object {
        try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks }
        catch { 0 }
    } -Descending)

    # Keep one featured play plus the latest 20 recent plays. Historical
    # Last.fm-derived rows remain visible because they are preserved in Turso.
    $Recent = @($History | Select-Object -First 21 | ForEach-Object {
        ConvertTo-PublicListeningPlay -Record $_
    })

    return [PSCustomObject]@{
        recent            = $Recent
        newlyArchived     = $SpotifyAdded
        spotifyNewlyAdded = $SpotifyAdded
        archiveTotal      = $History.Count
    }
}

function Invoke-ScheduledSpotifySync {
    if (-not $RuntimeConfig.IsWeb) {
        throw 'Scheduled Spotify sync is available only in hosted DriveOS.'
    }

    $Items = @(Get-SpotifyRecent -Limit 50)
    $Added = Save-SpotifyHistory -Items $Items
    $ArchiveTotal = @(Get-SpotifyHistory).Count
    $CompletedAt = [DateTimeOffset]::UtcNow.ToString('o')
    Write-DriveOSServerLog "Scheduled Spotify sync completed: $Added new play(s), $ArchiveTotal archived."

    return [PSCustomObject]@{
        ok = $true
        newlyArchived = $Added
        archiveTotal = $ArchiveTotal
        completedAt = $CompletedAt
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
    if ($script:PlaceAliasEntriesLoaded) {
        return @($script:PlaceAliasEntriesCache)
    }

    try {
        $Parsed = @(Get-DriveOSPlaceAliases -Repository $Repository)
        $script:PlaceAliasEntriesCache = @($Parsed)
        $script:PlaceAliasEntriesLoaded = $true
        return @($Parsed)
    }
    catch {
        Write-DriveOSServerLog "Place alias lookup failed: $($_.Exception.Message)"
        return @()
    }
}

function Get-PlaceAliasMap {
    return New-DriveOSPlaceAliasMap -Entries @(Get-PlaceAliasEntries)
}

function Get-FriendlyLocation {
    param(
        [string]$Location,
        $Latitude = $null,
        $Longitude = $null,
        $AliasMap = $null,
        $FoursquareCacheMap = $null
    )

    $ResolvedAliasMap = if ($null -ne $AliasMap) { $AliasMap } else { Get-PlaceAliasMap }
    $Friendly = Resolve-DriveOSFriendlyLocation -Location $Location -AliasMap $ResolvedAliasMap
    if ($Friendly -ne $Location) { return $Friendly }

    $Business = Get-FoursquareCachedPlace `
        -Location $Location `
        -Latitude $Latitude `
        -Longitude $Longitude `
        -CacheMap $FoursquareCacheMap

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

    $script:PlaceAliasEntriesCache = @($Entries)
    $script:PlaceAliasEntriesLoaded = $true
    $script:DriveDataCache.drives365 = $null
    $script:DriveDataCache.drives365ExpiresAt = [DateTimeOffset]::MinValue

    return [PSCustomObject]@{
        location = $Location
        label = $Label
        removed = -not [bool]$Label
    }
}

function Get-ChargingSettings {
    if ($null -ne $script:ChargingSettingsCache) {
        return $script:ChargingSettingsCache
    }

    $Rate = $null

    try {
        $Parsed = Get-DriveOSChargingSettingsRecord -Repository $Repository
        if ($Parsed -and $null -ne $Parsed.electricityRateCents) {
            $Rate = [double]$Parsed.electricityRateCents
        }
    }
    catch {
        Write-DriveOSServerLog "Charging settings lookup failed: $($_.Exception.Message)"
    }

    $script:ChargingSettingsCache = [PSCustomObject]@{
        electricityRateCents = $Rate
    }

    return $script:ChargingSettingsCache
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
    $script:ChargingSettingsCache = $Settings
    return $Settings
}

function ConvertTo-SafeDashboardLayout {
    param($Candidate)

    $AllowedIds = @('status','vehicle','music','drives','today','soundtrack','actions')
    $AllowedSizes = @('compact','standard','wide')
    $Order = New-Object Collections.ArrayList
    $Seen = @{}

    foreach ($Id in @($Candidate.order) + $AllowedIds) {
        $Value = "$Id"
        if ($Value -in $AllowedIds -and -not $Seen.ContainsKey($Value)) {
            [void]$Order.Add($Value)
            $Seen[$Value] = $true
        }
    }

    $Hidden = @($Candidate.hidden | ForEach-Object { "$_" } | Where-Object { $_ -in $AllowedIds } | Select-Object -Unique)
    $Pinned = @($Candidate.pinned | ForEach-Object { "$_" } | Where-Object { $_ -in $AllowedIds } | Select-Object -Unique)
    $Sizes = [ordered]@{}
    $Positions = [ordered]@{}

    foreach ($Id in $AllowedIds) {
        $Size = if ($Candidate.sizes -and $Candidate.sizes.PSObject.Properties[$Id]) { "$($Candidate.sizes.$Id)" } else { $null }
        if ($Size -in $AllowedSizes) { $Sizes[$Id] = $Size }

        $Position = if ($Candidate.positions -and $Candidate.positions.PSObject.Properties[$Id]) { $Candidate.positions.$Id } else { $null }
        if ($Position) {
            $RowValue = 0.0
            $ColValue = 0.0
            if (
                [double]::TryParse("$($Position.row)", [ref]$RowValue) -and
                [double]::TryParse("$($Position.col)", [ref]$ColValue)
            ) {
                $Row = [math]::Max(1, [math]::Min(50, [math]::Round($RowValue)))
                $Col = [math]::Max(1, [math]::Min(12, [math]::Round($ColValue)))
                $Positions[$Id] = [PSCustomObject]@{ row = [int]$Row; col = [int]$Col }
            }
        }
    }

    return [PSCustomObject]@{
        order = @($Order)
        hidden = $Hidden
        pinned = $Pinned
        positions = [PSCustomObject]$Positions
        sizes = [PSCustomObject]$Sizes
    }
}

function Get-DashboardLayout {
    $Stored = Get-DriveOSDashboardLayoutRecord -Repository $Repository
    if (-not $Stored -or -not $Stored.layout) {
        return [PSCustomObject]@{ version = 1; updatedAt = $null; layout = $null }
    }

    return [PSCustomObject]@{
        version = 1
        updatedAt = "$($Stored.updatedAt)"
        layout = ConvertTo-SafeDashboardLayout -Candidate $Stored.layout
    }
}

function Set-DashboardLayout {
    param($Candidate)

    if (-not $Candidate) { throw 'Dashboard layout is required.' }
    $Record = [PSCustomObject]@{
        version = 1
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        layout = ConvertTo-SafeDashboardLayout -Candidate $Candidate
    }
    Set-DriveOSDashboardLayoutRecord -Repository $Repository -LayoutRecord $Record
    return $Record
}

function Get-PlaceCandidates {
    $Counts = @{}
    $Coordinates = @{}
    $AliasMap = Get-PlaceAliasMap

    # Load the persisted Foursquare cache once for this entire request.
    # Without this, every unique Tessie location can trigger another Turso
    # read while building the candidate list.
    $FoursquareCacheMap = Get-FoursquareCacheMap

    foreach ($Drive in @(Get-CachedRawDrives365)) {
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
            -Longitude $(if ($Coordinate) { $Coordinate.longitude } else { $null }) `
            -CacheMap $FoursquareCacheMap
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
        # Refresh once only when the resolver actually persisted new matches.
        $FoursquareCacheMap = Get-FoursquareCacheMap
        foreach ($Place in $Places) {
            if ($Place.manualLabel) { continue }
            $Key = Get-DriveOSPlaceCacheKey -Location $Place.location -Latitude $Place.latitude -Longitude $Place.longitude
            if ($Key -and $FoursquareCacheMap.ContainsKey($Key) -and $FoursquareCacheMap[$Key].status -eq 'matched') {
                $Business = $FoursquareCacheMap[$Key]
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

function Get-CachedRawCharges365 {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.charges365 -and
        $script:DriveDataCache.charges365ExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.charges365)
    }

    $Charges = @(Get-RawCharges -Days 365)
    $script:DriveDataCache.charges365 = @($Charges)
    $script:DriveDataCache.charges365ExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

    return $Charges
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
    param(
        $Charge,
        $Settings = $null,
        $AliasMap = $null,
        $FoursquareCacheMap = $null
    )

    $ResolvedSettings = if ($null -ne $Settings) { $Settings } else { Get-ChargingSettings }

    return ConvertTo-DriveOSCharge `
        -Charge $Charge `
        -Settings $ResolvedSettings `
        -FriendlyLocation (
            Get-FriendlyLocation `
                -Location $Charge.location `
                -Latitude $Charge.latitude `
                -Longitude $Charge.longitude `
                -AliasMap $AliasMap `
                -FoursquareCacheMap $FoursquareCacheMap
        )
}

function Get-ChargingSummary {
    $Settings = Get-ChargingSettings
    $AliasMap = Get-PlaceAliasMap
    $FoursquareCacheMap = Get-FoursquareCacheMap

    $Sessions = @(
        Get-CachedRawCharges365 | ForEach-Object {
            Convert-RawCharge `
                -Charge $_ `
                -Settings $Settings `
                -AliasMap $AliasMap `
                -FoursquareCacheMap $FoursquareCacheMap
        }
    )

    $Cutoff30 = [DateTimeOffset]::Now.AddDays(-30)
    $Recent = @($Sessions | Where-Object { [DateTimeOffset]::Parse($_.startedAt) -ge $Cutoff30 })
    $TotalEnergy = [math]::Round((($Recent | Measure-Object energyAddedKWh -Sum).Sum), 2)
    $KnownCosts = @($Recent | Where-Object { $null -ne $_.displayCost })
    $TotalCost = if ($KnownCosts.Count) { [math]::Round((($KnownCosts | Measure-Object displayCost -Sum).Sum), 2) } else { $null }

    return [PSCustomObject]@{
        settings = $Settings
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
    $Drives = @(Get-CachedRecentDrives365)
    $Settings = Get-ChargingSettings
    $AliasMap = Get-PlaceAliasMap
    $FoursquareCacheMap = Get-FoursquareCacheMap
    $Charges = @(
        Get-CachedRawCharges365 | ForEach-Object {
            Convert-RawCharge `
                -Charge $_ `
                -Settings $Settings `
                -AliasMap $AliasMap `
                -FoursquareCacheMap $FoursquareCacheMap
        }
    )

    return New-DriveOSMonthlyRecaps -Drives $Drives -Charges $Charges -Settings $Settings
}

function Get-TessieHeaders {
    return @{ Authorization = "Bearer $env:TESSIE_TOKEN" }
}

function Get-VehicleRecord {
    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    return Get-TessieVehicle -Client $Client
}

function Get-VehicleSummary {
    param([switch]$ForceRefresh)
    $Now = [DateTimeOffset]::UtcNow

    if (
        -not $ForceRefresh -and
        $null -ne $script:VehicleSummaryCache -and
        $script:VehicleSummaryCacheExpiresAt -gt $Now
    ) {
        return $script:VehicleSummaryCache
    }

    $Vehicle = Get-VehicleRecord

    if (-not $Vehicle) {
        throw "No Tessie vehicle found."
    }

    $Summary = ConvertTo-DriveOSVehicleSummary -Vehicle $Vehicle
    $script:VehicleSummaryCache = $Summary
    $script:VehicleSummaryCacheExpiresAt = $Now.AddSeconds($VehicleSummaryCacheTtlSeconds)
    return $Summary
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
function Get-CachedRawDrives365 {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.rawDrives365 -and
        $script:DriveDataCache.rawDrives365ExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.rawDrives365)
    }

    $RawDrives = @(Get-RawDrives -Days 365)
    $script:DriveDataCache.rawDrives365 = @($RawDrives)
    $script:DriveDataCache.rawDrives365ExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

    return $RawDrives
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
                $Local = ConvertTo-DriveOSDisplayTime -Value $TrackStart

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

function Get-FullModeDriveRecords {
    if ($script:FullModeDriveRecordsLoaded) {
        return @($script:FullModeDriveRecordsMemory)
    }

    $Records = @()
    try {
        $Stored = if ($Repository.Provider -eq "Turso") {
            Get-DriveOSTursoState -Repository $Repository -Key "full-mode-drive-cache"
        }
        elseif (Test-Path $FullModeDriveCacheFile -PathType Leaf) {
            Read-DriveOSJson -Path $FullModeDriveCacheFile
        }
        else {
            $null
        }

        if ($Stored -and $Stored.PSObject.Properties['drives']) {
            $Records = @($Stored.drives)
        }
    }
    catch {
        Write-DriveOSServerLog "Full Mode drive cache lookup failed: $($_.Exception.Message)"
    }

    $script:FullModeDriveRecordsMemory = @($Records)
    $script:FullModeDriveRecordsLoaded = $true
    return @($Records)
}

function Save-FullModeDriveRecords {
    param([object[]]$Records)

    $ByDrive = [ordered]@{}
    foreach ($Record in @($Records)) {
        if ($Record.id) { $ByDrive["$($Record.id)"] = $Record }
    }

    $Stored = [PSCustomObject]@{
        version = 1
        updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
        drives = @($ByDrive.Values)
    }

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState -Repository $Repository -Key "full-mode-drive-cache" -Value $Stored
    }
    else {
        Write-DriveOSJson -Path $FullModeDriveCacheFile -Value $Stored
    }

    $script:FullModeDriveRecordsMemory = @($Stored.drives)
    $script:FullModeDriveRecordsLoaded = $true
}

function Convert-RawDrive {
    param(
        $Drive,
        [object[]]$SpotifyHistory = $null,
        $AliasMap = $null,
        $FoursquareCacheMap = $null,
        [object[]]$SoundtrackOverride = $null,
        [switch]$UseSoundtrackOverride
    )

    $Start=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.started_at).ToLocalTime();$End=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.ended_at).ToLocalTime()
    $Soundtrack = if ($UseSoundtrackOverride) {
        @($SoundtrackOverride)
    }
    else {
        @(Get-SoundtrackForWindow -DriveStart $Start -DriveEnd $End -History $SpotifyHistory)
    }
    return ConvertTo-DriveOSDrive -Drive $Drive -Soundtrack $Soundtrack `
        -StartingLocation (Get-FriendlyLocation -Location $Drive.starting_location -Latitude $Drive.starting_latitude -Longitude $Drive.starting_longitude -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap) `
        -EndingLocation (Get-FriendlyLocation -Location $Drive.ending_location -Latitude $Drive.ending_latitude -Longitude $Drive.ending_longitude -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap)
}

function Get-RecentDrives {
    param([ValidateRange(1, 730)][int]$Days = 30)

    $Output = @()
    $SpotifyHistory = $null
    $StoredRecords = @(Get-FullModeDriveRecords)
    $StoredByDrive = @{}
    foreach ($Record in $StoredRecords) {
        if ($Record.id) { $StoredByDrive["$($Record.id)"] = $Record }
    }
    $NewPermanentRecords = @()
    $FinalizationCutoff = [DateTimeOffset]::UtcNow.AddMinutes(-15)

    # Friendly-location data is shared across the entire build. In hosted mode
    # these maps come from Turso, so loading them once avoids hundreds of
    # repeated repository round trips for drive start/end locations.
    $AliasMap = Get-PlaceAliasMap
    $FoursquareCacheMap = Get-FoursquareCacheMap

    $RawDrives = if ($Days -eq 365) {
        @(Get-CachedRawDrives365)
    }
    else {
        @(Get-RawDrives -Days $Days)
    }

    foreach ($Raw in $RawDrives) {
        $DriveId = "$($Raw.started_at)-$($Raw.ended_at)"
        $StoredRecord = if ($StoredByDrive.ContainsKey($DriveId)) { $StoredByDrive[$DriveId] } else { $null }

        if ($StoredRecord) {
            $Converted = Convert-RawDrive `
                -Drive $Raw `
                -AliasMap $AliasMap `
                -FoursquareCacheMap $FoursquareCacheMap `
                -SoundtrackOverride @($StoredRecord.soundtrack) `
                -UseSoundtrackOverride
        }
        else {
            if ($null -eq $SpotifyHistory) {
                $SpotifyHistory = @(Get-SpotifyHistory)
            }
            $Converted = Convert-RawDrive `
                -Drive $Raw `
                -SpotifyHistory $SpotifyHistory `
                -AliasMap $AliasMap `
                -FoursquareCacheMap $FoursquareCacheMap

            $DriveEnd = [DateTimeOffset]::FromUnixTimeSeconds([long]$Raw.ended_at)
            if ($DriveEnd -le $FinalizationCutoff) {
                $NewPermanentRecords += [PSCustomObject]@{
                    id = $DriveId
                    soundtrack = @($Converted.soundtrack)
                    calculatedAt = [DateTimeOffset]::UtcNow.ToString("o")
                }
            }
        }

        $Output += $Converted
    }

    if ($NewPermanentRecords.Count -gt 0) {
        # Completed drives are immutable for soundtrack matching. Keep their
        # result durably and calculate only drives that have never been seen.
        Save-FullModeDriveRecords -Records @($StoredRecords + $NewPermanentRecords)
    }

    return $Output
}

function Get-CachedRecentDrives365 {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.drives365 -and
        $script:DriveDataCache.drives365ExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.drives365)
    }

    $Drives = @(Get-RecentDrives -Days 365)
    $script:DriveDataCache.drives365 = @($Drives)
    $script:DriveDataCache.drives365ExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

    return $Drives
}

function Get-CachedDashboardDrives {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.dashboardDrives -and
        $script:DriveDataCache.dashboardDrivesExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.dashboardDrives)
    }

    # The dashboard only needs a handful of recent trips. Avoid forcing the
    # 365-day Tessie history build just to paint three cards on a cold start.
    $Drives = @(Get-RecentDrives -Days 14 | Select-Object -First 10)
    $script:DriveDataCache.dashboardDrives = @($Drives)
    $script:DriveDataCache.dashboardDrivesExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

    return $Drives
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

function Get-DriveShareCardData {
    param([string]$DriveId)
    if (-not $DriveId) { throw "driveId is required." }

    $Drive = @(Get-CachedRecentDrives365 | Where-Object { $_.id -eq $DriveId } | Select-Object -First 1)[0]
    if (-not $Drive) { throw "Drive could not be found." }

    $MapData = $null
    try { $MapData = Get-DriveMapData -DriveId $DriveId }
    catch {
        Write-DriveOSServerLog "Share card route fallback for $DriveId`: $($_.Exception.Message)"
    }

    $Card = New-DriveOSShareCardModel -Drive $Drive -MapData $MapData

    # Defense in depth: the application model is deliberately allowlisted. A
    # future edit must never accidentally attach raw addresses or coordinates.
    if (
        $Card.PSObject.Properties['rawStartingLocation'] -or
        $Card.PSObject.Properties['rawEndingLocation'] -or
        $Card.PSObject.Properties['startingLatitude'] -or
        $Card.PSObject.Properties['endingLatitude']
    ) {
        throw "Share card privacy validation failed."
    }

    return $Card
}

# ------------------------------------------------------------
# Music + aggregate statistics
# ------------------------------------------------------------

function Get-SpotifyCatalogCacheKey {
    param([string[]]$Parts)

    return (@($Parts | ForEach-Object {
        ("$_" -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant()
    }) -join '|')
}

function Get-SpotifyCatalogCache {
    if ($script:SpotifyCatalogCacheLoaded) {
        return $script:SpotifyCatalogCacheMemory
    }

    $Cache = $null

    if ($Repository.Provider -eq "Turso") {
        try {
            $Cache = Get-DriveOSTursoState `
                -Repository $Repository `
                -Key "spotify-catalog-cache"
        }
        catch {}
    }
    elseif (Test-Path $SpotifyCatalogCacheFile -PathType Leaf) {
        try { $Cache = Read-DriveOSJson -Path $SpotifyCatalogCacheFile } catch {}
    }

    if (-not $Cache -or -not $Cache.PSObject.Properties['Version'] -or [int]$Cache.Version -ne 3) {
        $Cache = [PSCustomObject]@{ Version = 3; tracks = @(); artists = @() }
    }

    if (-not $Cache.PSObject.Properties['tracks']) {
        $Cache | Add-Member -NotePropertyName tracks -NotePropertyValue @()
    }

    if (-not $Cache.PSObject.Properties['artists']) {
        $Cache | Add-Member -NotePropertyName artists -NotePropertyValue @()
    }

    $script:SpotifyCatalogCacheMemory = $Cache
    $script:SpotifyCatalogCacheLoaded = $true
    return $Cache
}

function Save-SpotifyCatalogCache {
    param([Parameter(Mandatory=$true)]$Cache)

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-catalog-cache" `
            -Value $Cache
    }
    else {
        Write-DriveOSJson -Path $SpotifyCatalogCacheFile -Value $Cache
    }

    $script:SpotifyCatalogCacheMemory = $Cache
    $script:SpotifyCatalogCacheLoaded = $true
}

function Add-SpotifyCatalogDetailsToMusicStats {
    param(
        [Parameter(Mandatory=$true)]$Stats,
        [object[]]$History = @()
    )

    $Client = $null
    $Cache = Get-SpotifyCatalogCache
    $TrackCache = @($Cache.tracks)
    $ArtistCache = @($Cache.artists)
    $CacheChanged = $false

    foreach ($Item in @($Stats.topTracks)) {
        if ($Item.trackId -and $Item.albumImage) { continue }

        $Key = Get-SpotifyCatalogCacheKey -Parts @("$($Item.track)", "$($Item.artist)")
        $Entry = $TrackCache | Where-Object { "$($_.key)" -eq $Key } | Select-Object -First 1

        if (-not $Entry) {
            try {
                if (-not $Client) {
                    $Client = New-SpotifyClient -AccessToken (Get-SpotifyAccessToken)
                }
                $Track = Find-SpotifyTrack -Client $Client -Track "$($Item.track)" -Artist "$($Item.artist)"
                $AlbumImage = $null
                $CatalogAlbum = $null
                if ($Track -and $Track.album.images -and $Track.album.images.Count -gt 0) {
                    $AlbumImage = "$($Track.album.images[0].url)"
                }

                if (-not $Track -and $Item.album) {
                    $CatalogAlbum = Find-SpotifyAlbum -Client $Client -Album "$($Item.album)" -Artist "$($Item.artist)"
                }

                if (-not $Track -and -not $CatalogAlbum) {
                    $CatalogAlbum = Find-SpotifyLatestArtistAlbum -Client $Client -Artist "$($Item.artist)"
                }

                if (-not $AlbumImage -and $CatalogAlbum -and $CatalogAlbum.images -and $CatalogAlbum.images.Count -gt 0) {
                    $AlbumImage = "$($CatalogAlbum.images[0].url)"
                }

                $Entry = [PSCustomObject]@{
                    key        = $Key
                    found      = [bool]($Track -or $AlbumImage)
                    trackId    = if ($Track) { "$($Track.id)" } else { $null }
                    albumImage = $AlbumImage
                    spotifyUrl = if ($Track) { "$($Track.external_urls.spotify)" } elseif ($CatalogAlbum) { "$($CatalogAlbum.external_urls.spotify)" } else { $null }
                    updatedAt  = [DateTimeOffset]::UtcNow.ToString('o')
                }
                $TrackCache += $Entry
                $CacheChanged = $true
            }
            catch { continue }
        }

        if ($Entry.found) {
            if ($Entry.trackId) { $Item.trackId = "$($Entry.trackId)" }
            if ($Entry.albumImage) { $Item.albumImage = "$($Entry.albumImage)" }
            if ($Entry.spotifyUrl) { $Item.spotifyUrl = "$($Entry.spotifyUrl)" }
        }
    }

    foreach ($Item in @($Stats.topArtists)) {
        $Key = Get-SpotifyCatalogCacheKey -Parts @("$($Item.artist)")
        $Entry = $ArtistCache | Where-Object { "$($_.key)" -eq $Key } | Select-Object -First 1

        if (-not $Entry) {
            try {
                if (-not $Client) {
                    $Client = New-SpotifyClient -AccessToken (Get-SpotifyAccessToken)
                }
                $Artist = Find-SpotifyArtist -Client $Client -Artist "$($Item.artist)"
                $ImageUrl = $null
                $ImageSource = $null
                $LatestAlbum = $null

                if ($Artist -and $Artist.images -and $Artist.images.Count -gt 0) {
                    $ImageUrl = "$($Artist.images[0].url)"
                    $ImageSource = 'artist'
                }

                if (-not $ImageUrl) {
                    $LatestAlbum = Find-SpotifyLatestArtistAlbum -Client $Client -Artist "$($Item.artist)"
                    if ($LatestAlbum -and $LatestAlbum.images -and $LatestAlbum.images.Count -gt 0) {
                        $ImageUrl = "$($LatestAlbum.images[0].url)"
                        $ImageSource = 'album'
                    }
                }

                if (-not $ImageUrl) {
                    $FallbackRecord = $History |
                        Where-Object { "$($_.artist)" -eq "$($Item.artist)" -and $_.album_image } |
                        Sort-Object { try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks } catch { 0 } } -Descending |
                        Select-Object -First 1

                    if ($FallbackRecord) {
                        $ImageUrl = "$($FallbackRecord.album_image)"
                        $ImageSource = 'album'
                    }
                }

                $Entry = [PSCustomObject]@{
                    key         = $Key
                    found       = [bool]($Artist -or $ImageUrl)
                    artistId    = if ($Artist) { "$($Artist.id)" } elseif ($LatestAlbum -and $LatestAlbum.artists) { "$($LatestAlbum.artists[0].id)" } else { $null }
                    imageUrl    = $ImageUrl
                    imageSource = $ImageSource
                    spotifyUrl  = if ($Artist) { "$($Artist.external_urls.spotify)" } elseif ($LatestAlbum -and $LatestAlbum.artists) { "$($LatestAlbum.artists[0].external_urls.spotify)" } else { $null }
                    updatedAt   = [DateTimeOffset]::UtcNow.ToString('o')
                }
                $ArtistCache += $Entry
                $CacheChanged = $true
            }
            catch { continue }
        }

        $Item | Add-Member -NotePropertyName artistId -NotePropertyValue $Entry.artistId -Force
        $Item | Add-Member -NotePropertyName imageUrl -NotePropertyValue $Entry.imageUrl -Force
        $Item | Add-Member -NotePropertyName imageSource -NotePropertyValue $Entry.imageSource -Force
        $Item | Add-Member -NotePropertyName spotifyUrl -NotePropertyValue $Entry.spotifyUrl -Force
    }

    if ($CacheChanged) {
        $Cache.tracks = @($TrackCache)
        $Cache.artists = @($ArtistCache)
        Save-SpotifyCatalogCache -Cache $Cache
    }

    return $Stats
}

function Get-MusicStats {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $null -ne $script:MusicStatsCache -and
        $script:MusicStatsCacheExpiresAt -gt $Now
    ) {
        return $script:MusicStatsCache
    }

    $History = @(Get-SpotifyHistory)
    $Stats = New-DriveOSMusicStats -History $History
    $Result = Add-SpotifyCatalogDetailsToMusicStats -Stats $Stats -History $History

    $script:MusicStatsCache = $Result
    $script:MusicStatsCacheExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)
    return $Result
}

function Get-DriveStats {
    $Cutoff = [DateTimeOffset]::Now.AddDays(-30)
    $Drives = @(
        Get-CachedRecentDrives365 |
        Where-Object {
            try {
                [DateTimeOffset]::Parse("$($_.startedAt)") -ge $Cutoff
            }
            catch {
                $false
            }
        }
    )

    return New-DriveOSDriveStats -Drives $Drives -PeriodDays 30
}

function Get-AssistantAnswer {
    param([string]$Question)

    # The assistant receives only the application's normalized records. It cannot
    # execute database text, invoke external models, or alter any stored data.
    $Charging = Get-ChargingSummary
    return Get-DriveOSAssistantAnswer `
        -Question $Question `
        -Drives @(Get-CachedRecentDrives365) `
        -History @(Get-SpotifyHistory) `
        -Places @((Get-PlaceCandidates).places) `
        -Charges @($Charging.sessions)
}

# ------------------------------------------------------------
# Spotify playlist creation
# ------------------------------------------------------------

function New-DrivePlaylist {
    param([string]$DriveId)

    if (-not (Test-SpotifyScope "playlist-modify-private")) {
        throw "Spotify permission playlist-modify-private is missing. Run the updated Connect-Spotify.ps1 once, approve access, then try again."
    }

    $Drive = @(Get-CachedRecentDrives365) |
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

    $FoursquareStatus = Get-FoursquareConnectionStatus

    return [PSCustomObject]@{
        driveOS       = "online"
        tessie        = $VehicleOk
        spotify       = $SpotifyOk
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
# Hosted web authentication helpers
# ------------------------------------------------------------

function Send-Redirect {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [Parameter(Mandatory = $true)]
        [string]$Location
    )

    Send-HttpResponse `
        -Stream $Stream `
        -StatusCode 302 `
        -StatusText "Found" `
        -ContentType "text/plain; charset=utf-8" `
        -Body @() `
        -AdditionalHeaders @{
            Location = $Location
        }
}

function Test-DriveOSAuthenticatedWebRequest {
    param(
        [hashtable]$Headers
    )

    if (-not $RuntimeConfig.IsWeb -or -not $WebAuthConfig) {
        return $null
    }

    $Token = Get-DriveOSCookieValue `
        -Headers $Headers `
        -CookieName "DriveOSSession"

    if (-not $Token) {
        return $null
    }

    $Principal = Get-DriveOSWebSessionPrincipal -Token $Token -AuthSecret $WebAuthConfig.AuthSecret
    if (-not $Principal) { return $null }
    if ($Principal.Role -eq "owner" -and $Principal.Subject -eq $WebAuthConfig.OwnerEmail) { return $Principal }
    if ($Principal.Role -eq "wife" -and $WebAuthConfig.WifeUsername -and $Principal.Subject -eq $WebAuthConfig.WifeUsername) { return $Principal }
    return $null
}

function Get-WifeModeSummary {
    $Vehicle = Get-VehicleSummary
    $Drives = @(Get-WifeModeDrives)
    return [ordered]@{
        vehicle = [ordered]@{ name = $Vehicle.name; battery = $Vehicle.battery; rangeMiles = $Vehicle.rangeMiles; state = $Vehicle.state; gpsAsOf = $Vehicle.gpsAsOf }
        today = Get-WifeModeToday -Drives $Drives
        drives = $Drives
    }
}

function Get-WifeModeBaseDrives {
    $Now = [DateTimeOffset]::UtcNow
    if ($script:DriveDataCache.wifeDrives -and $script:DriveDataCache.wifeDrivesExpiresAt -gt $Now) {
        return @($script:DriveDataCache.wifeDrives)
    }

    $AliasMap = Get-PlaceAliasMap
    $FoursquareCacheMap = Get-FoursquareCacheMap
    $Drives = @(Get-RawDrives -Days 14 | Select-Object -First 10 | ForEach-Object {
        Convert-RawDrive -Drive $_ -SpotifyHistory @() -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap
    })
    $script:DriveDataCache.wifeDrives = @($Drives)
    $script:DriveDataCache.wifeDrivesExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)
    return $Drives
}

function Get-WifeModeDrives {
    return @(Get-WifeModeBaseDrives | Select-Object -First 6 | ForEach-Object {
        [ordered]@{
            id = $_.id; dateLabel = $_.dateLabel; shortDateLabel = $_.shortDateLabel
            dateIso = $_.dateIso
            startTime = $_.startTime; endTime = $_.endTime
            startingLocation = $_.startingLocation; endingLocation = $_.endingLocation
            miles = $_.miles; durationMinutes = $_.durationMinutes; startedAt = $_.startedAt
            startingBattery = $_.startingBattery; endingBattery = $_.endingBattery
            batteryUsed = $_.batteryUsed; energyKWh = $_.energyKWh
            efficiencyWhMi = $_.efficiencyWhMi; averageSpeed = $_.averageSpeed
            maxSpeed = $_.maxSpeed
        }
    })
}

function Get-WifeModeToday {
    param([object[]]$Drives)
    $TodayIso = [DateTimeOffset]::Now.ToLocalTime().ToString("yyyy-MM-dd")
    $Today = @($Drives | Where-Object { "$($_.dateIso)" -eq $TodayIso })
    $Miles = ($Today | ForEach-Object { [double]$_.miles } | Measure-Object -Sum).Sum
    if ($null -eq $Miles) { $Miles = 0 }
    return [ordered]@{ miles = [math]::Round([double]$Miles, 1); trips = $Today.Count }
}

function Get-WifeModeMusicRecords {
    if ($script:WifeModeMusicRecordsLoaded) {
        return @($script:WifeModeMusicRecordsMemory)
    }

    $Records = @()
    try {
        $Stored = if ($Repository.Provider -eq "Turso") {
            Get-DriveOSTursoState -Repository $Repository -Key "wife-mode-music"
        }
        elseif (Test-Path $WifeModeMusicFile -PathType Leaf) {
            Read-DriveOSJson -Path $WifeModeMusicFile
        }
        else {
            $null
        }

        if ($Stored -and $Stored.PSObject.Properties['drives']) {
            $Records = @($Stored.drives)
        }
    }
    catch {
        Write-DriveOSServerLog "Wife Mode music cache lookup failed: $($_.Exception.Message)"
    }

    $script:WifeModeMusicRecordsMemory = @($Records)
    $script:WifeModeMusicRecordsLoaded = $true
    return @($Records)
}

function Save-WifeModeMusicRecords {
    param([object[]]$Records)

    $Stored = [PSCustomObject]@{
        version = 1
        updatedAt = [DateTimeOffset]::UtcNow.ToString("o")
        drives = @($Records)
    }

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState -Repository $Repository -Key "wife-mode-music" -Value $Stored
    }
    else {
        Write-DriveOSJson -Path $WifeModeMusicFile -Value $Stored
    }

    $script:WifeModeMusicRecordsMemory = @($Records)
    $script:WifeModeMusicRecordsLoaded = $true
}

function Get-WifeModeMusic {
    $Drives = @(Get-WifeModeBaseDrives | Select-Object -First 6)
    if ($Drives.Count -eq 0) { return @() }

    $StoredRecords = @(Get-WifeModeMusicRecords)
    $StoredByDrive = @{}
    foreach ($Record in $StoredRecords) {
        if ($Record.id) { $StoredByDrive["$($Record.id)"] = $Record }
    }

    $ResultsByDrive = @{}
    foreach ($Drive in $Drives) {
        $DriveId = "$($Drive.id)"
        if ($StoredByDrive.ContainsKey($DriveId)) {
            $ResultsByDrive[$DriveId] = $StoredByDrive[$DriveId]
        }
    }

    $MissingDrives = @($Drives | Where-Object { -not $StoredByDrive.ContainsKey("$($_.id)") })
    if ($MissingDrives.Count -gt 0) {
        $History = @(Get-SpotifyHistory)
        $Windows = @($MissingDrives | ForEach-Object {
            [PSCustomObject]@{
                id = "$($_.id)"
                start = [DateTimeOffset]::Parse($_.startedAt)
                end = [DateTimeOffset]::Parse($_.endedAt)
                artists = @{}
                songCount = 0
            }
        })

        $Earliest = @($Windows | Sort-Object start | Select-Object -First 1)[0].start
        $Latest = @($Windows | Sort-Object end -Descending | Select-Object -First 1)[0].end

        foreach ($HistoryRecord in $History) {
            try {
                $TrackStart = [DateTimeOffset]::Parse($HistoryRecord.played_at)
                if ($TrackStart -gt $Latest) { continue }
                $DurationMs = if ($HistoryRecord.duration_ms) { [double]$HistoryRecord.duration_ms } else { 0 }
                $TrackEnd = $TrackStart.AddMilliseconds($DurationMs)
                if ($TrackEnd -lt $Earliest) { continue }

                foreach ($Window in $Windows) {
                    if ($TrackStart -lt $Window.end -and $TrackEnd -gt $Window.start) {
                        $Window.songCount++
                        $Artist = "$($HistoryRecord.artist)".Trim()
                        if ($Artist) {
                            if (-not $Window.artists.ContainsKey($Artist)) { $Window.artists[$Artist] = 0 }
                            $Window.artists[$Artist]++
                        }
                    }
                }
            }
            catch {}
        }

        $FinalizationCutoff = [DateTimeOffset]::UtcNow.AddMinutes(-15)
        $NewPermanentRecords = @()
        foreach ($Window in $Windows) {
            $TopArtist = @($Window.artists.GetEnumerator() | Sort-Object @{ Expression = 'Value'; Descending = $true }, @{ Expression = 'Key'; Descending = $false } | Select-Object -First 1 | ForEach-Object { $_.Key })[0]
            $MusicRecord = [PSCustomObject]@{
                id = $Window.id
                topArtist = $TopArtist
                songCount = $Window.songCount
                calculatedAt = [DateTimeOffset]::UtcNow.ToString("o")
            }
            $ResultsByDrive[$Window.id] = $MusicRecord

            # Allow Spotify's archive sync to catch up before permanently
            # finalizing a just-finished drive. Finalized drives never recalculate.
            if ($Window.end -le $FinalizationCutoff) {
                $NewPermanentRecords += $MusicRecord
            }
        }

        if ($NewPermanentRecords.Count -gt 0) {
            Save-WifeModeMusicRecords -Records @($StoredRecords + $NewPermanentRecords)
        }
    }

    return @($Drives | ForEach-Object {
        $Result = $ResultsByDrive["$($_.id)"]
        [ordered]@{
            id = $_.id
            topArtist = if ($Result) { $Result.topArtist } else { $null }
            songCount = if ($Result) { $Result.songCount } else { 0 }
        }
    })
}


function Get-WifeModeVehicle {
    $Vehicle = Get-VehicleSummary
    return [ordered]@{
        name = $Vehicle.name; battery = $Vehicle.battery; rangeMiles = $Vehicle.rangeMiles
        state = $Vehicle.state; gpsAsOf = $Vehicle.gpsAsOf
    }
}

function Get-WifeModeLiveLocation {
    $Vehicle = Get-VehicleSummary -ForceRefresh
    return [ordered]@{ name = $Vehicle.name; latitude = $Vehicle.latitude; longitude = $Vehicle.longitude; heading = $Vehicle.heading; gpsAsOf = $Vehicle.gpsAsOf }
}

# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

function Handle-Request {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$Method,
        [string]$Path,
        [string]$Target,
        [string]$BodyText,
        [hashtable]$Headers,
        [string]$ClientKey,
        $Principal = $null
    )

    try {
        if ($Method -eq "GET") {
            switch ($Path) {
                "/healthz" {
                    Send-Json -Stream $Stream -Object @{
                        status = "ok"
                    }
                    return
                }

                "/login" {
                    Send-StaticFile `
                        -Stream $Stream `
                        -RequestPath "/login.html"
                    return
                }

                "/wife" {
                    Send-StaticFile -Stream $Stream -RequestPath "/wife.html"
                    return
                }

                "/auth/spotify/callback" {
                    if (-not $RuntimeConfig.IsWeb) {
                        Send-Json `
                            -Stream $Stream `
                            -StatusCode 404 `
                            -StatusText "Not Found" `
                            -Object @{
                                error = "Not found."
                            }
                        return
                    }

                    Complete-SpotifyWebAuthorization `
                        -Target $Target

                    Send-Redirect `
                        -Stream $Stream `
                        -Location "/"
                    return
                }

                "/api/auth/session" {
                    Send-Json -Stream $Stream -Object @{
                        authenticated = $true
                        role = if ($Principal) { $Principal.Role } else { "owner" }
                        mode = if ($Principal) { $Principal.Mode } else { "full" }
                    }
                    return
                }

                "/api/wife/summary" {
                    Send-Json -Stream $Stream -Object (Get-WifeModeSummary)
                    return
                }

                "/api/wife/vehicle" {
                    Send-Json -Stream $Stream -Object (Get-WifeModeVehicle)
                    return
                }

                "/api/wife/drives" {
                    $WifeDrives = @(Get-WifeModeDrives)
                    Send-Json -Stream $Stream -Object @{ today = Get-WifeModeToday -Drives $WifeDrives; drives = $WifeDrives }
                    return
                }

                "/api/wife/music" {
                    Send-Json -Stream $Stream -Object @{ drives = @(Get-WifeModeMusic) }
                    return
                }

                "/api/wife/live" {
                    Send-Json -Stream $Stream -Object (Get-WifeModeLiveLocation)
                    return
                }

                "/api/status" {
                    Send-Json -Stream $Stream -Object (Get-OverallStatus)
                    return
                }

                "/api/vehicle" {
                    Send-Json -Stream $Stream -Object (Get-VehicleSummary)
                    return
                }

                "/api/vehicle/live" {
                    Send-Json -Stream $Stream -Object (Get-VehicleSummary -ForceRefresh)
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

                "/api/foursquare/status" {
                    Send-Json -Stream $Stream -Object (Get-FoursquareConnectionStatus)
                    return
                }

                "/api/music/stats" {
                    Send-Json -Stream $Stream -Object (Get-MusicStats)
                    return
                }

                "/api/drives/recent" {
                    Send-Json -Stream $Stream -Object @{
                        windowDays = 14
                        limited    = $true
                        drives     = @(Get-CachedDashboardDrives)
                    }
                    return
                }

                "/api/drives" {
                    Send-Json -Stream $Stream -Object @{
                        windowDays = 365
                        drives     = @(Get-CachedRecentDrives365)
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

                "/api/dashboard/layout" {
                    Send-Json -Stream $Stream -Object (Get-DashboardLayout)
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
                "/api/spotify/sync" {
                    if (-not (Test-DriveOSScheduledSyncRequest `
                        -IsWeb $RuntimeConfig.IsWeb `
                        -Method $Method `
                        -Path $Path `
                        -Headers $Headers `
                        -ExpectedSecret "$($env:DRIVEOS_SPOTIFY_SYNC_SECRET)")) {
                        Send-Json -Stream $Stream -StatusCode 401 -StatusText "Unauthorized" -Object @{
                            error = "Scheduled sync authentication failed."
                        }
                        return
                    }
                    Send-Json -Stream $Stream -Object (Invoke-ScheduledSpotifySync)
                    return
                }

                "/api/auth/login" {
                    if (-not (Test-DriveOSLoginAllowed -ClientKey $ClientKey)) {
                        Send-Json `
                            -Stream $Stream `
                            -StatusCode 429 `
                            -StatusText "Too Many Requests" `
                            -AdditionalHeaders @{
                                "Retry-After" = "30"
                            } `
                            -Object @{
                                error = "Too many login attempts. Please wait and try again."
                            }
                        return
                    }

                    $Body = ConvertFrom-DriveOSRequestBody `
                        -BodyText $BodyText `
                        -RequiredFields email,password

                    $Email = "$($Body.email)".Trim().ToLowerInvariant()
                    $PasswordText = "$($Body.password)"
                    $SecurePassword = ConvertTo-SecureString `
                        $PasswordText `
                        -AsPlainText `
                        -Force

                    $Body.password = $null
                    $PasswordText = $null

                    $OwnerEmailOk = Test-FixedTimeStringEquals $Email $WebAuthConfig.OwnerEmail
                    $OwnerPasswordOk = Test-DriveOSPassword -Password $SecurePassword -StoredHash $WebAuthConfig.PasswordHash
                    $WifeUsernameOk = $false
                    $WifePasswordOk = $false
                    if ($WebAuthConfig.WifeUsername) {
                        $WifeUsernameOk = Test-FixedTimeStringEquals $Email $WebAuthConfig.WifeUsername
                        $WifePasswordOk = Test-DriveOSPassword -Password $SecurePassword -StoredHash $WebAuthConfig.WifePasswordHash
                    }
                    $Role = if ($OwnerEmailOk -and $OwnerPasswordOk) { "owner" } elseif ($WifeUsernameOk -and $WifePasswordOk) { "wife" } else { $null }

                    if (-not $Role) {
                        Register-DriveOSLoginFailure -ClientKey $ClientKey

                        Send-Json `
                            -Stream $Stream `
                            -StatusCode 401 `
                            -StatusText "Unauthorized" `
                            -Object @{
                                error = "Invalid email or password."
                            }
                        return
                    }

                    Clear-DriveOSLoginFailures -ClientKey $ClientKey

                    $Token = New-DriveOSWebSessionToken `
                        -OwnerEmail $(if ($Role -eq "wife") { $WebAuthConfig.WifeUsername } else { $WebAuthConfig.OwnerEmail }) `
                        -Role $Role `
                        -Mode $(if ($Role -eq "wife") { "wife" } else { "full" }) `
                        -AuthSecret $WebAuthConfig.AuthSecret `
                        -SessionHours $RuntimeConfig.SessionHours

                    $Cookie = New-DriveOSWebSessionCookie `
                        -Token $Token `
                        -SessionHours $RuntimeConfig.SessionHours

                    Send-Json `
                        -Stream $Stream `
                        -AdditionalHeaders @{
                            "Set-Cookie" = $Cookie
                        } `
                        -Object @{
                            authenticated = $true
                            role = $Role
                        }
                    return
                }

                "/api/auth/logout" {
                    Send-Json `
                        -Stream $Stream `
                        -AdditionalHeaders @{
                            "Set-Cookie" = (New-DriveOSWebSessionClearCookie)
                        } `
                        -Object @{
                            authenticated = $false
                        }
                    return
                }

                "/api/wife/mode" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields mode
                    $Mode = "$($Body.mode)".Trim().ToLowerInvariant()
                    if ($Mode -notin @("wife", "full")) {
                        Send-Json -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Object @{ error = "Mode must be wife or full." }
                        return
                    }

                    if ($RuntimeConfig.IsDesktop) {
                        Send-Json -Stream $Stream -Object @{ mode = $Mode }
                        return
                    }

                    if (-not $Principal -or $Principal.Role -ne "wife") {
                        Send-Json -Stream $Stream -StatusCode 403 -StatusText "Forbidden" -Object @{ error = "Wife Mode access is required." }
                        return
                    }

                    $Token = New-DriveOSWebSessionToken `
                        -OwnerEmail $WebAuthConfig.WifeUsername `
                        -Role "wife" `
                        -Mode $Mode `
                        -AuthSecret $WebAuthConfig.AuthSecret `
                        -SessionHours $RuntimeConfig.SessionHours
                    Send-Json -Stream $Stream -AdditionalHeaders @{ "Set-Cookie" = (New-DriveOSWebSessionCookie -Token $Token -SessionHours $RuntimeConfig.SessionHours) } -Object @{ mode = $Mode }
                    return
                }

                "/api/spotify/connect" {
                    Send-Json -Stream $Stream -Object (Start-SpotifyAuthorization)
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

                "/api/dashboard/layout" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields layout
                    Send-Json -Stream $Stream -Object (Set-DashboardLayout -Candidate $Body.layout)
                    return
                }

                "/api/wife/drive/map" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId
                    Send-Json -Stream $Stream -Object (Get-DriveMapData -DriveId $Body.driveId)
                    return
                }

                "/api/drive/map" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId

                    Send-Json -Stream $Stream -Object (Get-DriveMapData -DriveId $Body.driveId)
                    return
                }

                "/api/drive/share-card" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId
                    Send-Json -Stream $Stream -Object (Get-DriveShareCardData -DriveId $Body.driveId)
                    return
                }

                "/api/playlist/create" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields driveId

                    Send-Json -Stream $Stream -Object (New-DrivePlaylist -DriveId $Body.driveId)
                    return
                }

                "/api/assistant/query" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields question
                    Send-Json -Stream $Stream -Object (Get-AssistantAnswer -Question "$($Body.question)")
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
        if (Test-DriveOSClientDisconnectError -Exception $_.Exception) {
            return
        }

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

if ($RefreshMusicCatalog) {
    $Stats = Get-MusicStats
    [PSCustomObject]@{
        topTracksWithArtwork = @($Stats.topTracks | Where-Object { $_.albumImage }).Count
        topArtistsWithArtwork = @($Stats.topArtists | Where-Object { $_.imageUrl }).Count
    } | ConvertTo-Json -Compress
    exit 0
}

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

function Test-DriveOSServerShouldRun {
    if ($RuntimeConfig.IsWeb) {
        return $true
    }

    return Test-DriveOSParentAlive
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
    while (Test-DriveOSServerShouldRun) {
        $AcceptResult = $Listener.BeginAcceptTcpClient($null, $null)

        while (-not $AcceptResult.IsCompleted) {
            if (-not (Test-DriveOSServerShouldRun)) {
                break
            }

            Start-Sleep -Milliseconds 100
        }

        if (-not (Test-DriveOSServerShouldRun)) {
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

            if ($Remote -isnot [System.Net.IPEndPoint]) {
                $Client.Close()
                continue
            }

            if (
                $RuntimeConfig.IsDesktop -and
                -not [System.Net.IPAddress]::IsLoopback($Remote.Address)
            ) {
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
            $IsRemoteTailscaleRequest = $false

            if ($RuntimeConfig.IsDesktop) {
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

                if (
                    -not $LocalSessionOk -and
                    (-not $TailscaleIdentityOk -or -not $RemoteHostOk)
                ) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "DriveOS session authentication failed."

                    continue
                }

                $IsRemoteTailscaleRequest = $TailscaleIdentityOk
            }
            elseif (-not (
                Test-DriveOSWebHost `
                    -HostHeader $RequestHost `
                    -PublicUrl $RuntimeConfig.PublicUrl
            )) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid host."

                continue
            }

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
            $WebPrincipal = $null

            if ($RuntimeConfig.IsWeb) {
                $ScheduledSpotifySyncOk = Test-DriveOSScheduledSyncRequest `
                    -IsWeb $RuntimeConfig.IsWeb `
                    -Method $Method `
                    -Path $Path `
                    -Headers $Headers `
                    -ExpectedSecret "$($env:DRIVEOS_SPOTIFY_SYNC_SECRET)"

                if (
                    $Method -eq "POST" -and
                    -not $ScheduledSpotifySyncOk -and
                    -not (
                        Test-DriveOSWebOrigin `
                            -Headers $Headers `
                            -PublicUrl $RuntimeConfig.PublicUrl
                    )
                ) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "Request origin validation failed."

                    continue
                }

                $WebPrincipal = Test-DriveOSAuthenticatedWebRequest -Headers $Headers
                $WebSessionOk = $null -ne $WebPrincipal

                $IsPublicWebRequest = Test-DriveOSWebPublicRequest `
                    -Method $Method `
                    -Path $Path

                if (
                    -not $IsPublicWebRequest -and
                    -not $WebSessionOk -and
                    -not $ScheduledSpotifySyncOk
                ) {
                    if ($Path.StartsWith("/api/")) {
                        Send-RequestRejected `
                            -Stream $Stream `
                            -Code 401 `
                            -Text "Unauthorized" `
                            -Message "Authentication required."
                    }
                    else {
                        Send-Redirect `
                            -Stream $Stream `
                            -Location "/login"
                    }

                    continue
                }

                $WifePostAllowed = $Method -eq "POST" -and $Path -in @("/api/wife/mode", "/api/wife/drive/map")
                if ($WebPrincipal -and $WebPrincipal.Role -eq "wife" -and $Method -eq "POST" -and -not $IsPublicWebRequest -and -not $WifePostAllowed) {
                    Send-RequestRejected -Stream $Stream -Code 403 -Text "Forbidden" -Message "This feature is only available in owner mode."
                    continue
                }

                if ($WebPrincipal -and $WebPrincipal.Role -eq "wife" -and $WebPrincipal.Mode -ne "full") {
                    $WifeApiAllowed = $Method -eq "GET" -and $Path -in @("/api/auth/session", "/api/wife/summary", "/api/wife/vehicle", "/api/wife/drives", "/api/wife/music", "/api/wife/live")
                    $WifeApiAllowed = $WifeApiAllowed -or ($Method -eq "POST" -and $Path -in @("/api/wife/mode", "/api/wife/drive/map"))
                    if ($Path.StartsWith("/api/") -and -not $WifeApiAllowed) {
                        Send-RequestRejected -Stream $Stream -Code 403 -Text "Forbidden" -Message "This feature is only available in owner mode."
                        continue
                    }
                    if ($Path -eq "/") {
                        Send-Redirect -Stream $Stream -Location "/wife"
                        continue
                    }
                }

                if (
                    $WebSessionOk -and
                    $Method -eq "GET" -and
                    $Path -in @("/login", "/login.html")
                ) {
                    Send-Redirect `
                        -Stream $Stream `
                        -Location "/"

                    continue
                }
            }

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
                -Target $Target `
                -BodyText $BodyText `
                -Headers $Headers `
                -ClientKey $Remote.Address.ToString() `
                -Principal $WebPrincipal
        }
        catch {
            if (-not (Test-DriveOSClientDisconnectError -Exception $_.Exception)) {
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
