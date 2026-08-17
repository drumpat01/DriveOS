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
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.TessieReadiness.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.Collections.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.Attachments.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.MobilityGraph.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Application\DriveOS.MobilityPreferences.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Http\DriveOS.Http.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebAuth.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebSession.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.Passkeys.psm1") -Force
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
$PlaceAliasesFile = Join-Path $DataDirectory "place-aliases.json"
$FoursquareConfigFile = Join-Path $DataDirectory "foursquare-config.json"
$FoursquareCacheFile = Join-Path $DataDirectory "foursquare-place-cache.json"
$FoursquareUsageFile = Join-Path $DataDirectory "foursquare-usage.json"
$ChargingSettingsFile = Join-Path $DataDirectory "charging-settings.json"
$FoursquareDailyLimit = 500
$FoursquareMonthlyLimit = 500
$script:FoursquareApiKeyForRedaction = $null

# Expensive Tessie-derived data is reused briefly across the dashboard's
# back-to-back API calls. This is process-local only and disappears on restart.
$script:DriveDataCache = @{
    rawDrives730 = $null
    rawDrives730ExpiresAt = [DateTimeOffset]::MinValue
    drives730 = $null
    drives730ExpiresAt = [DateTimeOffset]::MinValue
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
$script:DriveSoundtrackRecordsMemory = @{}
$script:DriveSoundtrackRecordsLoaded = $false
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

function Test-DriveOSEnabledEnvironmentFlag {
    param([Parameter(Mandatory=$true)][string]$Name)
    $Value = [Environment]::GetEnvironmentVariable($Name)
    if (-not $Value) { return $false }
    if ($Value.Trim().ToLowerInvariant() -in @('1','true','yes','on')) { return $true }
    if ($Value.Trim().ToLowerInvariant() -in @('0','false','no','off')) { return $false }
    throw "$Name must be true or false."
}

$Repository = New-DriveOSRepository -DataDirectory $DataDirectory -AppRoot $PSScriptRoot
$DurableTessieWriteEnabled = Test-DriveOSEnabledEnvironmentFlag -Name 'JOURNEYDECK_TESSIE_DB_WRITE_ENABLED'
$DurableTessieReadEnabled = Test-DriveOSEnabledEnvironmentFlag -Name 'JOURNEYDECK_TESSIE_DB_READ_ENABLED'
$DurableTessieReadCanaryApproved = Test-DriveOSEnabledEnvironmentFlag -Name 'JOURNEYDECK_TESSIE_READ_CANARY_APPROVED'
if (($DurableTessieWriteEnabled -or $DurableTessieReadEnabled) -and $Repository.Provider -notin @('SQLite','Turso')) {
    throw 'Durable Tessie history flags require the SQLite or Turso repository provider.'
}
if ($DurableTessieReadEnabled -and -not $DurableTessieReadCanaryApproved) {
    throw 'JOURNEYDECK_TESSIE_DB_READ_ENABLED requires JOURNEYDECK_TESSIE_READ_CANARY_APPROVED=true after a passing 30-day parity report.'
}
if ($DurableTessieReadEnabled -and -not $DurableTessieWriteEnabled) {
    throw 'JOURNEYDECK_TESSIE_DB_READ_ENABLED requires JOURNEYDECK_TESSIE_DB_WRITE_ENABLED=true so the external worker remains active.'
}
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

if ($DurableTessieReadEnabled) {
    $ReadMaximumStalenessMinutes = 45
    if ($env:JOURNEYDECK_TESSIE_READ_MAX_STALENESS_MINUTES -and (
        -not [int]::TryParse("$($env:JOURNEYDECK_TESSIE_READ_MAX_STALENESS_MINUTES)",[ref]$ReadMaximumStalenessMinutes) -or
        $ReadMaximumStalenessMinutes -lt 5 -or
        $ReadMaximumStalenessMinutes -gt 1440
    )) {
        throw 'JOURNEYDECK_TESSIE_READ_MAX_STALENESS_MINUTES must be between 5 and 1440.'
    }
    $null = Assert-JourneyDeckTessieReadReady -Repository $Repository -MaximumStalenessMinutes $ReadMaximumStalenessMinutes
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
    param([int]$Limit = 50,[AllowNull()][string]$Before)

    $Page = Get-SpotifyRecentPage -Limit $Limit -Before $Before
    return @($Page.items)
}

function Get-SpotifyRecentPage {
    param([int]$Limit = 50,[AllowNull()][string]$Before)

    $Token = Get-SpotifyAccessToken
    $Client = New-SpotifyClient -AccessToken $Token
    return Get-SpotifyRecentlyPlayedPage -Client $Client -Limit $Limit -Before $Before
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

    # Only collapse alternate-provider/Spotify overlap. Never collapse two
    # Spotify plays, so genuine repeat listens remain intact.
    if ($CandidateSource -eq $ExistingSource) {
        return $false
    }

    if (
        @($CandidateSource, $ExistingSource) -notcontains "spotify" -or
        (@($CandidateSource, $ExistingSource) -notcontains "lastfm" -and
         @($CandidateSource, $ExistingSource) -notcontains "youtube_music")
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
    $CandidateIndexesByTrack = @{}
    $MaximumWindowSeconds = 720

    foreach ($Record in @($Records | Sort-Object {
        try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks }
        catch { 0 }
    })) {
        $DuplicateIndex = -1
        $TrackKey = ConvertTo-ListeningMatchText "$($Record.track)"
        $PlayedAtEpoch = try {
            [DateTimeOffset]::Parse("$($Record.played_at)").ToUnixTimeSeconds()
        }
        catch { $null }

        if (
            $TrackKey -and
            $null -ne $PlayedAtEpoch -and
            $CandidateIndexesByTrack.ContainsKey($TrackKey)
        ) {
            $ActiveIndexes = New-Object Collections.ArrayList

            foreach ($Index in @($CandidateIndexesByTrack[$TrackKey])) {
                $ExistingRecord = $Kept[[int]$Index]
                $ExistingEpoch = try {
                    [DateTimeOffset]::Parse("$($ExistingRecord.played_at)").ToUnixTimeSeconds()
                }
                catch { $null }

                if (
                    $null -eq $ExistingEpoch -or
                    [long]$ExistingEpoch -lt ([long]$PlayedAtEpoch - $MaximumWindowSeconds)
                ) {
                    continue
                }

                [void]$ActiveIndexes.Add([int]$Index)
                if (
                    $DuplicateIndex -lt 0 -and
                    (Test-CrossProviderListeningDuplicate `
                        -Candidate $Record `
                        -ExistingRecord $ExistingRecord)
                ) {
                    $DuplicateIndex = [int]$Index
                }
            }

            $CandidateIndexesByTrack[$TrackKey] = $ActiveIndexes
        }

        if ($DuplicateIndex -lt 0) {
            $NewIndex = $Kept.Add($Record)
            if ($TrackKey -and $null -ne $PlayedAtEpoch) {
                if (-not $CandidateIndexesByTrack.ContainsKey($TrackKey)) {
                    $CandidateIndexesByTrack[$TrackKey] = New-Object Collections.ArrayList
                }
                [void]$CandidateIndexesByTrack[$TrackKey].Add([int]$NewIndex)
            }
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
        $script:DriveDataCache.drives730 = $null
        $script:DriveDataCache.drives730ExpiresAt = [DateTimeOffset]::MinValue
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
    $script:DriveDataCache.drives730 = $null
    $script:DriveDataCache.drives730ExpiresAt = [DateTimeOffset]::MinValue
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

    foreach ($Candidate in @(Select-DriveOSPlaceLookupCandidates -Candidates $Candidates -Limit 500)) {
        $Key = Get-DriveOSPlaceCacheKey -Location $Candidate.location -Latitude $Candidate.latitude -Longitude $Candidate.longitude
        if (-not $Key) { continue }

        if ($Map.ContainsKey($Key)) {
            $Existing = $Map[$Key]
            if ($Existing.status -eq 'matched') { continue }
            # A completed miss is also a completed one-time lookup. It remains
            # persisted until an owner deliberately clears the cache.
            if ($Existing.status -eq 'none') { continue }
        }

        if (-not (Register-FoursquareApiCall)) { break }

        try {
            $Places = @(Search-FoursquarePlaces -Client $Client `
                -Latitude ([double]$Candidate.latitude) -Longitude ([double]$Candidate.longitude) `
                -RadiusMeters 250 -Limit 5)
            $BusinessMatch = Select-DriveOSFoursquareMatch -Places $Places -MaximumDistanceMeters 75
            $AddressMatch = @($Places | Where-Object {
                -not [string]::IsNullOrWhiteSpace([string]$_.address) -and
                $null -ne $_.distanceMeters -and [double]$_.distanceMeters -le 250
            } | Sort-Object distanceMeters | Select-Object -First 1)[0]
            $Match = if ($BusinessMatch) { $BusinessMatch } else { $AddressMatch }
            $ResolvedName = if ($BusinessMatch) { [string]$BusinessMatch.name } elseif ($AddressMatch) { [string]$AddressMatch.address } else { $null }
            $Entry = [PSCustomObject]@{
                key = $Key
                location = [string]$Candidate.location
                latitude = [double]$Candidate.latitude
                longitude = [double]$Candidate.longitude
                status = if ($ResolvedName) { 'matched' } else { 'none' }
                name = $ResolvedName
                address = if ($Match) { [string]$Match.address } else { $null }
                fsqPlaceId = if ($Match) { [string]$Match.id } else { $null }
                category = if ($Match) { [string]$Match.category } else { $null }
                resolutionType = if ($BusinessMatch) { 'business' } elseif ($AddressMatch) { 'address' } else { 'unresolved' }
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
            if ($ResolvedName) { $NewMatches++ }
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
    # The scheduled background sync owns Spotify polling and durable writes.
    # Dashboard requests read the same archive in hosted and desktop modes.
    $SpotifyAdded = 0

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
    param([switch]$RestartSoundtrackBackfill)

    if (-not $RuntimeConfig.IsWeb) {
        throw 'Scheduled Spotify sync is available only in hosted DriveOS.'
    }

    try {
        $AttemptedAt = [DateTimeOffset]::UtcNow.ToString('o')
        $RecentPage = Get-SpotifyRecentPage -Limit 50
        $Items = @($RecentPage.items | Where-Object { $null -ne $_ })
        $Added = Save-SpotifyHistory -Items $Items
        $SoundtracksUpdated = 0
        $Backfill = $null
        $ReconciliationError = $null
        try {
            # Reconcile the previous day after every successful archive. Delayed
            # Spotify runs can therefore repair an already-finalized soundtrack.
            $SoundtracksUpdated = Update-RecentDriveSoundtrackCache -Days 1
            $Backfill = Invoke-SoundtrackBackfillStep `
                -InitialBefore (Get-SpotifyPageBeforeCursor -Page $RecentPage) `
                -Restart:$RestartSoundtrackBackfill
            $Added += [int]$Backfill.spotifyPlaysArchivedThisRun
            $SoundtracksUpdated += [int]$Backfill.drivesProcessedThisRun
        }
        catch {
            $ReconciliationError = $_.Exception.Message
            Write-DriveOSServerLog "Drive soundtrack reconciliation failed after Spotify sync: $ReconciliationError"
        }
        $ArchiveTotal = @(Get-SpotifyHistory).Count
        $CompletedAt = [DateTimeOffset]::UtcNow.ToString('o')
        Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'spotify' -Record ([ordered]@{
            provider = 'spotify'
            status = if ($ReconciliationError) { 'degraded' } else { 'healthy' }
            lastAttemptAtUtc = $AttemptedAt
            lastSuccessAtUtc = $CompletedAt
            newlyArchived = $Added
            archiveTotal = $ArchiveTotal
            soundtracksUpdated = $SoundtracksUpdated
            soundtrackBackfill = $Backfill
            lastError = $ReconciliationError
        })
        Write-DriveOSServerLog "Scheduled Spotify sync completed: $Added new play(s), $ArchiveTotal archived, $SoundtracksUpdated drive soundtrack(s) reconciled."

        return [PSCustomObject]@{
            ok = $true
            newlyArchived = $Added
            archiveTotal = $ArchiveTotal
            soundtracksUpdated = $SoundtracksUpdated
            soundtrackBackfill = $Backfill
            completedAt = $CompletedAt
        }
    }
    catch {
        $SyncError = $_.Exception.Message
        $Previous = $null
        try { $Previous = Get-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'spotify' } catch {}
        try {
            Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'spotify' -Record ([ordered]@{
                provider = 'spotify'
                status = 'failed'
                lastAttemptAtUtc = if ($AttemptedAt) { $AttemptedAt } else { [DateTimeOffset]::UtcNow.ToString('o') }
                lastSuccessAtUtc = if ($Previous -and $Previous.PSObject.Properties['lastSuccessAtUtc']) { $Previous.lastSuccessAtUtc } else { $null }
                newlyArchived = 0
                archiveTotal = if ($Previous -and $Previous.PSObject.Properties['archiveTotal']) { $Previous.archiveTotal } else { $null }
                soundtracksUpdated = 0
                lastError = $SyncError
            })
        }
        catch { Write-DriveOSServerLog "Spotify sync health persistence failed: $($_.Exception.Message)" }
        throw
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
    $script:DriveDataCache.drives730 = $null
    $script:DriveDataCache.drives730ExpiresAt = [DateTimeOffset]::MinValue

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
    param([switch]$Enrich)

    $PlaceRecords = @{}
    $AliasMap = Get-PlaceAliasMap

    # Load the persisted Foursquare cache once for this entire request.
    # Without this, every unique Tessie location can trigger another Turso
    # read while building the candidate list.
    $FoursquareCacheMap = Get-FoursquareCacheMap

    foreach ($Drive in @(Get-CachedRawDrives730)) {
        $Endpoints = @(
            [PSCustomObject]@{ location=$Drive.starting_location; latitude=$Drive.starting_latitude; longitude=$Drive.starting_longitude },
            [PSCustomObject]@{ location=$Drive.ending_location; latitude=$Drive.ending_latitude; longitude=$Drive.ending_longitude }
        )
        foreach ($Endpoint in $Endpoints) {
            $Value = "$($Endpoint.location)".Trim()
            if (-not $Value) { continue }
            $Latitude = if ($null -ne $Endpoint.latitude) { [double]$Endpoint.latitude } else { $null }
            $Longitude = if ($null -ne $Endpoint.longitude) { [double]$Endpoint.longitude } else { $null }
            $Key = Get-DriveOSPlaceCacheKey -Location $Value -Latitude $Latitude -Longitude $Longitude
            if (-not $Key) { continue }
            $GenericImported = $Value -match '^(Google Timeline location|Unknown (start|destination|location))$'
            $GroupKey = if ($GenericImported -and $null -ne $Latitude -and $null -ne $Longitude) {
                'timeline:' + [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0:F3},{1:F3}', $Latitude, $Longitude)
            }
            else { $Key }

            # Timeline imports commonly use the same placeholder for thousands
            # of distinct coordinates. Grouping by the cache key keeps each
            # repeated physical place independent for one-time enrichment.
            if (-not $PlaceRecords.ContainsKey($GroupKey)) {
                $PlaceRecords[$GroupKey] = [PSCustomObject]@{
                    key = $Key
                    location = $Value
                    uses = 0
                    latitude = $Latitude
                    longitude = $Longitude
                }
            }
            $PlaceRecords[$GroupKey].uses++
        }
    }

    $Places = @($PlaceRecords.Values | ForEach-Object {
        $Record = $_
        $Location = [string]$Record.location
        $GenericImported = $Location -match '^(Google Timeline location|Unknown (start|destination|location))$'
        $ManualLabel = if ((-not $GenericImported) -and $AliasMap.ContainsKey($Location)) { [string]$AliasMap[$Location] } else { "" }
        $Business = Get-FoursquareCachedPlace -Location $Location `
            -Latitude $Record.latitude `
            -Longitude $Record.longitude `
            -CacheMap $FoursquareCacheMap
        [PSCustomObject]@{
            key = [string]$Record.key
            location = $Location
            label = $ManualLabel
            manualLabel = $ManualLabel
            businessName = if ($Business) { [string]$Business.name } else { $null }
            businessAddress = if ($Business -and $Business.PSObject.Properties['address']) { [string]$Business.address } else { $null }
            businessCategory = if ($Business) { [string]$Business.category } else { $null }
            businessDistanceMeters = if ($Business) { $Business.distanceMeters } else { $null }
            displayName = if ($ManualLabel) { $ManualLabel } elseif ($Business) { [string]$Business.name } else { $Location }
            source = if ($ManualLabel) { 'manual' } elseif ($Business -and $Business.PSObject.Properties['provider'] -and $Business.provider) { [string]$Business.provider } elseif ($Business) { 'foursquare' } else { 'tessie' }
            uses = [int]$Record.uses
            latitude = $Record.latitude
            longitude = $Record.longitude
        }
    })

    $NewMatches = if ($Enrich) { Resolve-FoursquareCandidatePlaces -Candidates $Places } else { 0 }
    if ($NewMatches -gt 0) {
        # Refresh once only when the resolver actually persisted new matches.
        $FoursquareCacheMap = Get-FoursquareCacheMap
        foreach ($Place in $Places) {
            if ($Place.manualLabel) { continue }
            $Key = Get-DriveOSPlaceCacheKey -Location $Place.location -Latitude $Place.latitude -Longitude $Place.longitude
            if ($Key -and $FoursquareCacheMap.ContainsKey($Key) -and $FoursquareCacheMap[$Key].status -eq 'matched') {
                $Business = $FoursquareCacheMap[$Key]
                $Place.businessName = [string]$Business.name
                $Place.businessAddress = if ($Business.PSObject.Properties['address']) { [string]$Business.address } else { $null }
                $Place.businessCategory = [string]$Business.category
                $Place.businessDistanceMeters = $Business.distanceMeters
                $Place.displayName = [string]$Business.name
                $Place.source = if ($Business.PSObject.Properties['provider'] -and $Business.provider) { [string]$Business.provider } else { 'foursquare' }
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

    if ($DurableTessieReadEnabled) {
        return @(Get-DriveOSTessieCharges -Repository $Repository -Days $Days)
    }

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
    $Drives = @(Get-CachedRecentDrives730)
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

    if ($DurableTessieReadEnabled) {
        return @(Get-DriveOSTessieDrives -Repository $Repository -Days $Days)
    }

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

function Get-CachedRawDrives730 {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.rawDrives730 -and
        $script:DriveDataCache.rawDrives730ExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.rawDrives730)
    }

    $RawDrives = @(Get-RawDrives -Days 730)
    $script:DriveDataCache.rawDrives730 = @($RawDrives)
    $script:DriveDataCache.rawDrives730ExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

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

function Get-DriveSoundtrackRecordMap {
    if ($script:DriveSoundtrackRecordsLoaded) { return $script:DriveSoundtrackRecordsMemory }

    $Map = @{}
    foreach ($Record in @(Get-DriveOSDriveSoundtracks -Repository $Repository)) {
        if ($Record.driveId) { $Map["$($Record.driveId)"] = $Record }
    }
    $script:DriveSoundtrackRecordsMemory = $Map
    $script:DriveSoundtrackRecordsLoaded = $true
    return $script:DriveSoundtrackRecordsMemory
}

function Save-DriveSoundtrackRecord {
    param([Parameter(Mandatory=$true)]$Record)
    Set-DriveOSDriveSoundtrack -Repository $Repository -Record $Record
    $Map = Get-DriveSoundtrackRecordMap
    $Map["$($Record.driveId)"] = $Record
}

function Get-CachedDriveSoundtrack {
    param([Parameter(Mandatory=$true)][string]$DriveId)

    # Request paths consume only the durable projection. Spotify matching and
    # persistence belong to Update-RecentDriveSoundtrackCache.
    $Map = Get-DriveSoundtrackRecordMap
    if (-not $Map.ContainsKey($DriveId)) { return @() }
    # Older cache payloads can contain a null array element. Treat it as an
    # absent song so one malformed legacy entry cannot break every drive read.
    return @($Map[$DriveId].songs | Where-Object { $null -ne $_ })
}

function Get-CanonicalDriveSoundtrack {
    param(
        [Parameter(Mandatory=$true)][string]$DriveId,
        [Parameter(Mandatory=$true)][DateTimeOffset]$DriveStart,
        [Parameter(Mandatory=$true)][DateTimeOffset]$DriveEnd,
        [object[]]$SpotifyHistory = $null,
        [switch]$Reconcile,
        [switch]$ForcePersist
    )

    $Map = Get-DriveSoundtrackRecordMap
    $Existing = if ($Map.ContainsKey($DriveId)) { $Map[$DriveId] } else { $null }
    $Now = [DateTimeOffset]::UtcNow

    if ($Existing -and -not $Reconcile) {
        if ("$($Existing.status)" -eq "finalized") { return @($Existing.songs) }
        try {
            if ([DateTimeOffset]::Parse("$($Existing.calculatedAt)").AddMinutes(15) -gt $Now) {
                return @($Existing.songs)
            }
        }
        catch {}
    }

    if ($null -eq $SpotifyHistory) { $SpotifyHistory = @(Get-SpotifyHistory) }
    $Songs = @(Get-SoundtrackForWindow -DriveStart $DriveStart -DriveEnd $DriveEnd -History $SpotifyHistory)
    $Status = if ($DriveEnd.ToUniversalTime() -le $Now.AddHours(-3)) { "finalized" } else { "pending" }
    $TopArtist = @($Songs | Group-Object artist | Sort-Object @{ Expression = 'Count'; Descending = $true }, @{ Expression = 'Name'; Descending = $false } | Select-Object -First 1 | ForEach-Object { $_.Name })[0]
    $SourceLatestPlayedAt = @($SpotifyHistory | Sort-Object { try { [DateTimeOffset]::Parse($_.played_at) } catch { [DateTimeOffset]::MinValue } } -Descending | Select-Object -First 1 | ForEach-Object { $_.played_at })[0]
    $Record = [PSCustomObject]@{
        version = 1; driveId = $DriveId
        startedAt = $DriveStart.ToString("o"); endedAt = $DriveEnd.ToString("o")
        status = $Status; songCount = $Songs.Count; topArtist = $TopArtist
        songs = @($Songs); sourceLatestPlayedAt = $SourceLatestPlayedAt
        calculatedAt = $Now.ToString("o")
    }

    $IsRecent = $DriveEnd.ToUniversalTime() -ge $Now.AddHours(-24)
    if ($ForcePersist -or $Reconcile -or $IsRecent -or $Existing) {
        $ExistingIdentity = if ($Existing) { @($Existing.songs | ForEach-Object { "$($_.playedAt)|$($_.trackId)|$($_.track)" }) -join "`n" } else { $null }
        $NewIdentity = @($Songs | ForEach-Object { "$($_.playedAt)|$($_.trackId)|$($_.track)" }) -join "`n"
        if (-not $Existing -or $ExistingIdentity -ne $NewIdentity -or "$($Existing.status)" -ne $Status -or $Status -eq "pending") {
            Save-DriveSoundtrackRecord -Record $Record
        }
        else { $Record = $Existing }
    }
    return @($Record.songs)
}

function Update-RecentDriveSoundtrackCache {
    param([ValidateRange(1, 7)][int]$Days = 1)

    $History = @(Get-SpotifyHistory)
    $Updated = 0
    foreach ($RawDrive in @(Get-RawDrives -Days $Days)) {
        $Start = [DateTimeOffset]::FromUnixTimeSeconds([long]$RawDrive.started_at)
        $End = [DateTimeOffset]::FromUnixTimeSeconds([long]$RawDrive.ended_at)
        $DriveId = "$($RawDrive.started_at)-$($RawDrive.ended_at)"
        $null = Get-CanonicalDriveSoundtrack -DriveId $DriveId -DriveStart $Start -DriveEnd $End -SpotifyHistory $History -Reconcile -ForcePersist
        $Updated++
    }
    return $Updated
}

function Get-SpotifyPageBeforeCursor {
    param($Page)

    if (
        $Page -and
        $Page.PSObject.Properties['cursors'] -and
        $Page.cursors -and
        $Page.cursors.PSObject.Properties['before'] -and
        -not [string]::IsNullOrWhiteSpace("$($Page.cursors.before)")
    ) {
        return "$($Page.cursors.before)"
    }

    return $null
}

function New-SoundtrackBackfillState {
    param([AllowNull()][string]$InitialBefore)

    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    return [PSCustomObject]@{
        version = 1
        status = 'running'
        spotifyBefore = $InitialBefore
        spotifyComplete = [string]::IsNullOrWhiteSpace($InitialBefore)
        spotifyPagesFetched = 0
        spotifyPlaysArchived = 0
        projectionInitialized = $false
        pendingDriveIds = @()
        drivesProcessed = 0
        startedAtUtc = $Now
        updatedAtUtc = $Now
        completedAtUtc = $null
        lastError = $null
    }
}

function Get-AtlasPlaceEnrichment {
    $Places = @(Get-FoursquareCacheEntries | Where-Object { $_.status -eq 'matched' } | ForEach-Object {
        $Provider = if ($_.PSObject.Properties['provider'] -and $_.provider) { [string]$_.provider } else { 'foursquare' }
        [PSCustomObject]@{
            key = [string]$_.key
            latitude = $_.latitude
            longitude = $_.longitude
            name = [string]$_.name
            address = if ($_.PSObject.Properties['address']) { [string]$_.address } else { $null }
            category = [string]$_.category
            distanceMeters = $_.distanceMeters
            resolvedAt = [string]$_.resolvedAt
            source = $Provider
            attribution = if ($_.PSObject.Properties['attribution']) { [string]$_.attribution } else { $null }
        }
    })

    return [PSCustomObject]@{
        version = 1
        persisted = $true
        places = $Places
        foursquare = Get-FoursquareConnectionStatus
    }
}

function Invoke-AtlasPlaceEnrichmentScan {
    # This bounded pass writes every lookup outcome to the database-backed
    # Foursquare cache. Later Atlas loads only read the compact projection.
    $Before = @(Get-FoursquareCacheEntries).Count
    $Result = Get-PlaceCandidates -Enrich
    $Snapshot = Get-AtlasPlaceEnrichment
    $After = @(Get-FoursquareCacheEntries).Count
    $Snapshot | Add-Member -NotePropertyName scanned -NotePropertyValue $true
    $Snapshot | Add-Member -NotePropertyName candidates -NotePropertyValue @($Result.places).Count
    $Snapshot | Add-Member -NotePropertyName imported -NotePropertyValue ([Math]::Max(0, $After - $Before))
    return $Snapshot
}

function Get-SoundtrackBackfillState {
    return Get-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'soundtrack-backfill'
}

function Save-SoundtrackBackfillState {
    param([Parameter(Mandatory=$true)]$State)
    $State.updatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
    Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'soundtrack-backfill' -Record $State
}

function Invoke-SoundtrackBackfillStep {
    param(
        [AllowNull()][string]$InitialBefore,
        [switch]$Restart,
        [ValidateRange(1,10)][int]$MaxSpotifyPages = 2,
        [ValidateRange(1,100)][int]$DriveBatchSize = 20,
        [ValidateRange(1,730)][int]$Days = 365
    )

    $State = Get-SoundtrackBackfillState
    if (
        $Restart -or
        -not $State -or
        -not $State.PSObject.Properties['version'] -or
        [int]$State.version -ne 1
    ) {
        $State = New-SoundtrackBackfillState -InitialBefore $InitialBefore
        Save-SoundtrackBackfillState -State $State
    }

    if ("$($State.status)" -eq 'completed') {
        return [PSCustomObject]@{
            status = 'completed'
            spotifyPagesFetchedThisRun = 0
            spotifyPlaysArchivedThisRun = 0
            drivesProcessedThisRun = 0
            remainingDrives = 0
        }
    }

    $PagesThisRun = 0
    $ArchivedThisRun = 0
    $DrivesThisRun = 0

    try {
        while (-not [bool]$State.spotifyComplete -and $PagesThisRun -lt $MaxSpotifyPages) {
            $Before = "$($State.spotifyBefore)"
            if ([string]::IsNullOrWhiteSpace($Before)) {
                $State.spotifyComplete = $true
                break
            }

            $Page = Get-SpotifyRecentPage -Limit 50 -Before $Before
            $Items = @($Page.items | Where-Object { $null -ne $_ })
            if ($Items.Count -eq 0) {
                $State.spotifyComplete = $true
                break
            }

            $Added = Save-SpotifyHistory -Items $Items
            $ArchivedThisRun += $Added
            $PagesThisRun++
            $State.spotifyPagesFetched = [int]$State.spotifyPagesFetched + 1
            $State.spotifyPlaysArchived = [int]$State.spotifyPlaysArchived + $Added

            $NextBefore = Get-SpotifyPageBeforeCursor -Page $Page
            if ([string]::IsNullOrWhiteSpace($NextBefore) -or $NextBefore -eq $Before) {
                $State.spotifyComplete = $true
                $State.spotifyBefore = $null
            }
            else {
                $State.spotifyBefore = $NextBefore
            }
            Save-SoundtrackBackfillState -State $State
        }

        if ([bool]$State.spotifyComplete) {
            $RawDrives = @(Get-RawDrives -Days $Days)
            if (-not [bool]$State.projectionInitialized) {
                $State.pendingDriveIds = @($RawDrives | ForEach-Object { "$($_.started_at)-$($_.ended_at)" })
                $State.projectionInitialized = $true
                Save-SoundtrackBackfillState -State $State
            }

            $PendingIds = @($State.pendingDriveIds | Where-Object { -not [string]::IsNullOrWhiteSpace("$_") })
            $BatchIds = @($PendingIds | Select-Object -First $DriveBatchSize)
            if ($BatchIds.Count -gt 0) {
                $RawById = @{}
                foreach ($RawDrive in $RawDrives) {
                    $RawById["$($RawDrive.started_at)-$($RawDrive.ended_at)"] = $RawDrive
                }
                $History = @(Get-SpotifyHistory)
                foreach ($DriveId in $BatchIds) {
                    if ($RawById.ContainsKey($DriveId)) {
                        $RawDrive = $RawById[$DriveId]
                        $Start = [DateTimeOffset]::FromUnixTimeSeconds([long]$RawDrive.started_at)
                        $End = [DateTimeOffset]::FromUnixTimeSeconds([long]$RawDrive.ended_at)
                        $null = Get-CanonicalDriveSoundtrack -DriveId $DriveId -DriveStart $Start -DriveEnd $End -SpotifyHistory $History -Reconcile -ForcePersist
                    }
                    $DrivesThisRun++
                }

                $Completed = @{}; foreach ($DriveId in $BatchIds) { $Completed[$DriveId] = $true }
                $State.pendingDriveIds = @($PendingIds | Where-Object { -not $Completed.ContainsKey("$_") })
                $State.drivesProcessed = [int]$State.drivesProcessed + $DrivesThisRun

                # Public drive models are immutable snapshots. Clear them so
                # the next request observes the rebuilt soundtrack projection.
                $script:DriveDataCache.drives730 = $null
                $script:DriveDataCache.drives730ExpiresAt = [DateTimeOffset]::MinValue
                $script:DriveDataCache.dashboardDrives = $null
                $script:DriveDataCache.dashboardDrivesExpiresAt = [DateTimeOffset]::MinValue
                $script:DriveDataCache.wifeDrives = $null
                $script:DriveDataCache.wifeDrivesExpiresAt = [DateTimeOffset]::MinValue
            }

            if (@($State.pendingDriveIds).Count -eq 0) {
                $State.status = 'completed'
                $State.completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
            }
        }

        $State.lastError = $null
        Save-SoundtrackBackfillState -State $State
    }
    catch {
        $State.status = 'running'
        $State.lastError = $_.Exception.Message
        Save-SoundtrackBackfillState -State $State
        throw
    }

    return [PSCustomObject]@{
        status = "$($State.status)"
        spotifyPagesFetchedThisRun = $PagesThisRun
        spotifyPlaysArchivedThisRun = $ArchivedThisRun
        drivesProcessedThisRun = $DrivesThisRun
        remainingDrives = @($State.pendingDriveIds).Count
    }
}

function Convert-RawDrive {
    param(
        $Drive,
        $AliasMap = $null,
        $FoursquareCacheMap = $null,
        [switch]$SkipSoundtrack
    )

    $Start=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.started_at).ToLocalTime();$End=[DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.ended_at).ToLocalTime()
    $DriveId="$($Drive.started_at)-$($Drive.ended_at)"
    $Soundtrack = if ($SkipSoundtrack) { @() } else { @(Get-CachedDriveSoundtrack -DriveId $DriveId) }
    return ConvertTo-DriveOSDrive -Drive $Drive -Soundtrack $Soundtrack `
        -StartingLocation (Get-FriendlyLocation -Location $Drive.starting_location -Latitude $Drive.starting_latitude -Longitude $Drive.starting_longitude -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap) `
        -EndingLocation (Get-FriendlyLocation -Location $Drive.ending_location -Latitude $Drive.ending_latitude -Longitude $Drive.ending_longitude -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap)
}

function Get-RecentDrives {
    param([ValidateRange(1, 730)][int]$Days = 30)

    $Output = @()

    # Friendly-location data is shared across the entire build. In hosted mode
    # these maps come from Turso, so loading them once avoids hundreds of
    # repeated repository round trips for drive start/end locations.
    $AliasMap = Get-PlaceAliasMap
    $FoursquareCacheMap = Get-FoursquareCacheMap

    $RawDrives = if ($Days -eq 730) {
        @(Get-CachedRawDrives730)
    }
    else {
        @(Get-RawDrives -Days $Days)
    }

    foreach ($Raw in $RawDrives) {
        $Output += Convert-RawDrive `
            -Drive $Raw `
            -AliasMap $AliasMap `
            -FoursquareCacheMap $FoursquareCacheMap
    }

    return $Output
}

function Get-CachedRecentDrives730 {
    $Now = [DateTimeOffset]::UtcNow

    if (
        $script:DriveDataCache.drives730 -and
        $script:DriveDataCache.drives730ExpiresAt -gt $Now
    ) {
        return @($script:DriveDataCache.drives730)
    }

    $Drives = @(Get-RecentDrives -Days 730)
    $script:DriveDataCache.drives730 = @($Drives)
    $script:DriveDataCache.drives730ExpiresAt = $Now.AddSeconds($DriveDataCacheTtlSeconds)

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
    # 730-day history build just to paint three cards on a cold start.
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
    $Soundtrack = @(Get-CachedDriveSoundtrack -DriveId $DriveId)

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

    $Drive = @(Get-CachedRecentDrives730 | Where-Object { $_.id -eq $DriveId } | Select-Object -First 1)[0]
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
        Get-CachedRecentDrives730 |
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

    # Search is deliberately bounded to drive records and soundtracks attached
    # to those drives. Global listening and charging history never enter the
    # assistant, so every answer means "while driving" by construction.
    return Get-DriveOSAssistantAnswer `
        -Question $Question `
        -Drives @(Get-CachedRecentDrives730) `
        -Places @((Get-PlaceCandidates).places)
}

# ------------------------------------------------------------
# Spotify playlist creation
# ------------------------------------------------------------

function New-DrivePlaylist {
    param([string]$DriveId)

    if (-not (Test-SpotifyScope "playlist-modify-private")) {
        throw "Spotify permission playlist-modify-private is missing. Run the updated Connect-Spotify.ps1 once, approve access, then try again."
    }

    $Drive = @(Get-CachedRecentDrives730) |
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
        Convert-RawDrive -Drive $_ -AliasMap $AliasMap -FoursquareCacheMap $FoursquareCacheMap -SkipSoundtrack
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

function Get-WifeModeMusic {
    $Drives = @(Get-WifeModeBaseDrives | Select-Object -First 6)
    if ($Drives.Count -eq 0) { return @() }

    return @($Drives | ForEach-Object {
        $Songs = @(Get-CachedDriveSoundtrack -DriveId "$($_.id)")
        $TopArtist = @($Songs | Group-Object artist | Sort-Object Count -Descending | Select-Object -First 1 | ForEach-Object { $_.Name })[0]
        [ordered]@{
            id = $_.id
            topArtist = $TopArtist
            songCount = $Songs.Count
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

function Get-DataHealthCursorSignal {
    param([Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource)

    $Cursor = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider 'tessie' -Resource $Resource
    if (-not $Cursor) {
        return [ordered]@{ id="tessie-$Resource"; name="Tessie $Resource"; status='unknown'; lastAttemptAtUtc=$null; lastSuccessAtUtc=$null; highWatermarkUtc=$null; lagMinutes=$null; lastError='No successful sync cursor has been recorded yet.' }
    }

    $LastSuccess = $null
    $HighWatermark = $null
    try { if ($Cursor.last_success_at_utc) { $LastSuccess = [DateTimeOffset]::Parse("$($Cursor.last_success_at_utc)") } } catch {}
    try { if ($Cursor.high_watermark_utc) { $HighWatermark = [DateTimeOffset]::Parse("$($Cursor.high_watermark_utc)") } } catch {}
    $FreshnessPoint = if ($HighWatermark) { $HighWatermark } else { $LastSuccess }
    $LagMinutes = if ($FreshnessPoint) { [Math]::Max(0, [Math]::Round(([DateTimeOffset]::UtcNow - $FreshnessPoint.ToUniversalTime()).TotalMinutes)) } else { $null }
    $Status = if ($Cursor.last_error) { 'failed' } elseif ($null -eq $LagMinutes) { 'unknown' } elseif ($LagMinutes -gt 45) { 'stale' } else { 'healthy' }

    return [ordered]@{
        id = "tessie-$Resource"
        name = "Tessie $Resource"
        status = $Status
        lastAttemptAtUtc = $Cursor.last_attempt_at_utc
        lastSuccessAtUtc = $Cursor.last_success_at_utc
        highWatermarkUtc = $Cursor.high_watermark_utc
        lagMinutes = $LagMinutes
        lastError = $Cursor.last_error
    }
}

function Get-DataHealthAlerts {
    param(
        [object[]]$Signals = @(),
        $SoundtrackProjection = $null,
        $Rollout = $null,
        [string]$RepositoryProvider = '',
        [bool]$IsWeb = $false
    )

    $Alerts = @()
    foreach ($Signal in @($Signals)) {
        if (-not $Signal) { continue }
        $Status = "$($Signal.status)".ToLowerInvariant()
        $Name = if ($Signal.name) { "$($Signal.name)" } else { 'Background worker' }
        $Id = if ($Signal.id) { "$($Signal.id)" } else { 'integration' }
        if ($Status -eq 'failed') {
            $Alerts += [ordered]@{ id="$Id-failed"; severity='critical'; title=if($Id -eq 'integrity-audit'){'Daily integrity audit failed'}else{"$Name sync failed"}; message=if ($Signal.lastError) { "$($Signal.lastError)" } else { 'The latest background worker attempt did not complete successfully.' } }
        }
        elseif ($Status -eq 'stale') {
            $Lag = if ($null -ne $Signal.lagMinutes) { " ($([Math]::Round([double]$Signal.lagMinutes)) minutes behind)" } else { '' }
            $Alerts += [ordered]@{ id="$Id-stale"; severity='warning'; title="$Name is late"; message=if($Id -eq 'integrity-audit'){'No successful integrity audit has been recorded in the last 26 hours.'}else{"The durable sync cursor is outside the expected 45-minute window$Lag."} }
        }
        elseif ($Status -eq 'unknown') {
            $Alerts += [ordered]@{ id="$Id-unknown"; severity='warning'; title="$Name has no successful sync"; message='JourneyDeck is waiting for this worker to publish durable health data.' }
        }
        elseif ($Status -eq 'degraded' -or $Status -eq 'attention') {
            $Alerts += [ordered]@{ id="$Id-attention"; severity='warning'; title="$Name needs attention"; message=if ($Signal.lastError) { "$($Signal.lastError)" } else { 'The integration reported a degraded state.' } }
        }
    }

    $Missing = if ($SoundtrackProjection -and $null -ne $SoundtrackProjection.missingCount) { [int]$SoundtrackProjection.missingCount } else { 0 }
    if ($Missing -gt 0) {
        $Alerts += [ordered]@{ id='soundtracks-missing'; severity='warning'; title="$Missing recent drive soundtrack$(if ($Missing -eq 1) { '' } else { 's' }) missing"; message='A drive exists in durable history without a materialized soundtrack record.' }
    }

    if ($IsWeb) {
        if ($RepositoryProvider -ne 'Turso') {
            $Alerts += [ordered]@{ id='database-provider'; severity='critical'; title='Production database is not Turso'; message='Hosted JourneyDeck is not using the expected durable repository.' }
        }
        if (-not $Rollout -or -not $Rollout.tessieWritesEnabled) {
            $Alerts += [ordered]@{ id='tessie-writes'; severity='critical'; title='Durable Tessie writes are disabled'; message='New drive and charging history will not be archived to Turso.' }
        }
        if (-not $Rollout -or -not $Rollout.tessieReadsEnabled) {
            $Alerts += [ordered]@{ id='tessie-reads'; severity='warning'; title='Database history reads are disabled'; message='Historical screens are not reading the durable Tessie repository.' }
        }
        if (-not $Rollout -or -not $Rollout.readCanaryApproved) {
            $Alerts += [ordered]@{ id='read-canary'; severity='warning'; title='Read canary is not approved'; message='The durable-history parity gate is not active.' }
        }
    }

    return @($Alerts)
}

function Get-DataHealthSummary {
    $History = @(Get-DriveOSListeningHistory -Repository $Repository)
    $SpotifyHealth = Get-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'spotify'
    $LatestPlay = @($History | Sort-Object { try { [DateTimeOffset]::Parse("$($_.played_at)").UtcTicks } catch { 0 } } -Descending | Select-Object -First 1)
    $SpotifyStatus = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['status']) { "$($SpotifyHealth.status)" } else { 'unknown' }
    $SpotifyLastSuccess = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['lastSuccessAtUtc']) { $SpotifyHealth.lastSuccessAtUtc } else { $null }
    $SpotifyLag = $null
    try { if ($SpotifyLastSuccess) { $SpotifyLag = [Math]::Max(0, [Math]::Round(([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse("$SpotifyLastSuccess").ToUniversalTime()).TotalMinutes)) } } catch {}
    if ($SpotifyStatus -eq 'healthy' -and $null -ne $SpotifyLag -and $SpotifyLag -gt 45) { $SpotifyStatus = 'stale' }

    $SpotifySignal = [ordered]@{
        id = 'spotify'
        name = 'Spotify history + soundtracks'
        status = $SpotifyStatus
        lastAttemptAtUtc = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['lastAttemptAtUtc']) { $SpotifyHealth.lastAttemptAtUtc } else { $null }
        lastSuccessAtUtc = $SpotifyLastSuccess
        highWatermarkUtc = if ($LatestPlay.Count) { $LatestPlay[0].played_at } else { $null }
        lagMinutes = $SpotifyLag
        lastError = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['lastError']) { $SpotifyHealth.lastError } else { 'Waiting for the next scheduled Spotify sync to publish health.' }
        archiveTotal = $History.Count
        newlyArchived = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['newlyArchived']) { $SpotifyHealth.newlyArchived } else { $null }
        soundtracksUpdated = if ($SpotifyHealth -and $SpotifyHealth.PSObject.Properties['soundtracksUpdated']) { $SpotifyHealth.soundtracksUpdated } else { $null }
    }

    # Health reads the durable projection directly. It never calls Tessie from
    # the web request process, even if the normal history-read flag is off.
    $RecentRawDrives = if ($Repository.Provider -in @('SQLite','Turso')) { @(Get-DriveOSTessieDrives -Repository $Repository -Days 1) } else { @() }
    $SoundtrackRows = @(Get-DriveOSDriveSoundtracks -Repository $Repository)
    $SoundtrackMap = @{}
    foreach ($Row in $SoundtrackRows) { if ($Row -and $Row.driveId) { $SoundtrackMap["$($Row.driveId)"] = $Row } }
    $Missing = 0
    $Pending = 0
    foreach ($Drive in $RecentRawDrives) {
        $DriveId = "$($Drive.started_at)-$($Drive.ended_at)"
        if (-not $SoundtrackMap.ContainsKey($DriveId)) { $Missing++; continue }
        $Row = $SoundtrackMap[$DriveId]
        if ($Row.PSObject.Properties['status'] -and "$($Row.status)" -eq 'pending') { $Pending++ }
    }

    $LatestAudit = Get-DriveOSLatestIntegrityAuditRun -Repository $Repository -AuditKind 'tessie-parity'
    $AuditLag = $null
    try { if ($LatestAudit -and $LatestAudit.completedAtUtc) { $AuditLag = [Math]::Max(0,[Math]::Round(([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse("$($LatestAudit.completedAtUtc)").ToUniversalTime()).TotalMinutes)) } } catch {}
    $AuditStatus = if (-not $LatestAudit) { 'unknown' } elseif ($LatestAudit.status -ne 'ready' -or -not $LatestAudit.readyForReadCanary) { 'failed' } elseif ($null -eq $AuditLag -or $AuditLag -gt 1560) { 'stale' } else { 'healthy' }
    $AuditSignal = [ordered]@{
        id = 'integrity-audit'
        name = 'Daily integrity audit'
        status = $AuditStatus
        lastAttemptAtUtc = if($LatestAudit){$LatestAudit.generatedAtUtc}else{$null}
        lastSuccessAtUtc = if($LatestAudit -and $LatestAudit.readyForReadCanary){$LatestAudit.completedAtUtc}else{$null}
        highWatermarkUtc = if($LatestAudit){$LatestAudit.rangeToUtc}else{$null}
        lagMinutes = $AuditLag
        lastError = if(-not $LatestAudit){'No durable integrity audit result has been recorded yet.'}elseif($AuditStatus -eq 'failed'){'The latest durable parity audit did not approve database reads.'}else{$null}
    }

    $Signals = @((Get-DataHealthCursorSignal -Resource drives),(Get-DataHealthCursorSignal -Resource charges),$SpotifySignal,$AuditSignal)
    $Projection = [ordered]@{ recentDriveCount=$RecentRawDrives.Count; materializedCount=($RecentRawDrives.Count-$Missing); missingCount=$Missing; pendingCount=$Pending }
    $Rollout = [ordered]@{ tessieWritesEnabled=$DurableTessieWriteEnabled; tessieReadsEnabled=$DurableTessieReadEnabled; readCanaryApproved=$DurableTessieReadCanaryApproved }
    $Alerts = @(Get-DataHealthAlerts -Signals $Signals -SoundtrackProjection $Projection -Rollout $Rollout -RepositoryProvider $Repository.Provider -IsWeb $RuntimeConfig.IsWeb)
    $Statuses = @($Signals | ForEach-Object { $_.status })
    $Overall = if ($Statuses -contains 'failed' -or @($Alerts | Where-Object { $_.severity -eq 'critical' }).Count) { 'failed' } elseif ($Alerts.Count) { 'attention' } elseif ($Statuses -contains 'unknown') { 'warming-up' } else { 'healthy' }

    return [ordered]@{
        generatedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
        overallStatus = $Overall
        repositoryProvider = $Repository.Provider
        integrations = $Signals
        alerts = $Alerts
        soundtrackProjection = $Projection
        integrityAudit = $LatestAudit
        rollout = $Rollout
    }
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

                "/api/wife/collections" {
                    Send-Json -Stream $Stream -Object @{ collections = @(Get-JourneyCollections -Repository $Repository) }
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
                        windowDays = 730
                        drives     = @(Get-CachedRecentDrives730)
                    }
                    return
                }

                "/api/mobility-graph" {
                    $Drives = @(Get-CachedRecentDrives730)
                    Send-Json -Stream $Stream -Object (New-DriveOSMobilityGraph -Drives $Drives -WindowDays 730 -Preferences (Get-MobilityPreferences -Repository $Repository))
                    return
                }

                "/api/collections" {
                    Send-Json -Stream $Stream -Object @{ collections = @(Get-JourneyCollections -Repository $Repository) }
                    return
                }

                "/api/auth/passkey/status" {
                    $Credential = Get-DriveOSPasskeyRecord -Repository $Repository
                    Send-Json -Stream $Stream -Object @{ registered = [bool]($Credential -and $Credential.credentialId) }
                    return
                }

                "/api/statistics" {
                    Send-Json -Stream $Stream -Object (Get-DriveStats)
                    return
                }

                "/api/data-health" {
                    if ($RuntimeConfig.IsWeb -and (-not $Principal -or $Principal.Role -ne 'owner')) {
                        Send-Json -Stream $Stream -StatusCode 403 -StatusText "Forbidden" -Object @{ error = "Data Health is available only to the owner." }
                        return
                    }
                    Send-Json -Stream $Stream -Object (Get-DataHealthSummary)
                    return
                }

                "/api/places" {
                    Send-Json -Stream $Stream -Object (Get-PlaceCandidates)
                    return
                }

                "/api/atlas/places" {
                    Send-Json -Stream $Stream -Object (Get-AtlasPlaceEnrichment)
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
                    $RestartBackfill = $false
                    if (-not [string]::IsNullOrWhiteSpace($BodyText)) {
                        try {
                            $SyncRequest = $BodyText | ConvertFrom-Json
                            if ($SyncRequest.PSObject.Properties['restartBackfill']) {
                                $RestartBackfill = [bool]$SyncRequest.restartBackfill
                            }
                        }
                        catch {
                            Send-Json -Stream $Stream -StatusCode 400 -StatusText "Bad Request" -Object @{
                                error = "Scheduled sync body must be valid JSON."
                            }
                            return
                        }
                    }
                    Send-Json -Stream $Stream -Object (Invoke-ScheduledSpotifySync -RestartSoundtrackBackfill:$RestartBackfill)
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

                "/api/atlas/places/scan" {
                    Send-Json -Stream $Stream -Object (Invoke-AtlasPlaceEnrichmentScan)
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

                "/api/auth/passkey/options" {
                    $Credential = Get-DriveOSPasskeyRecord -Repository $Repository
                    if (-not $Credential -or -not $Credential.credentialId) {
                        Send-Json -Stream $Stream -Object @{ available=$false }
                        return
                    }
                    $Challenge = New-DriveOSPasskeyChallenge -Purpose authenticate -ClientKey $ClientKey
                    Send-Json -Stream $Stream -Object @{
                        available=$true; challengeId=$Challenge.challengeId; challenge=$Challenge.challenge
                        rpId=([Uri]$RuntimeConfig.PublicUrl).Host; credentialId=$Credential.credentialId
                    }
                    return
                }

                "/api/auth/passkey/verify" {
                    if (-not (Test-DriveOSLoginAllowed -ClientKey $ClientKey)) {
                        Send-Json -Stream $Stream -StatusCode 429 -StatusText 'Too Many Requests' -AdditionalHeaders @{ 'Retry-After'='30' } -Object @{error='Too many login attempts. Please wait and try again.'};return
                    }
                    $Body=ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields challengeId,credentialId,clientDataJSON,authenticatorData,signature
                    try{$Challenge=Use-DriveOSPasskeyChallenge -ChallengeId "$($Body.challengeId)" -Purpose authenticate -ClientKey $ClientKey}catch{Register-DriveOSLoginFailure -ClientKey $ClientKey;Send-Json -Stream $Stream -StatusCode 401 -StatusText Unauthorized -Object @{error='Face ID sign-in expired. Try again.'};return}
                    $Credential=Get-DriveOSPasskeyRecord -Repository $Repository
                    $Origin=([Uri]$RuntimeConfig.PublicUrl).GetLeftPart([UriPartial]::Authority).TrimEnd('/')
                    $Valid=$Credential -and (Test-FixedTimeStringEquals "$($Body.credentialId)" "$($Credential.credentialId)") -and (Test-DriveOSPasskeyAssertion -ClientDataJSON "$($Body.clientDataJSON)" -AuthenticatorData "$($Body.authenticatorData)" -Signature "$($Body.signature)" -PublicKeySpki "$($Credential.publicKeySpki)" -ExpectedChallenge $Challenge.challenge -Origin $Origin -RpId ([Uri]$RuntimeConfig.PublicUrl).Host)
                    if(-not $Valid){Register-DriveOSLoginFailure -ClientKey $ClientKey;Send-Json -Stream $Stream -StatusCode 401 -StatusText Unauthorized -Object @{error='Face ID could not verify this passkey.'};return}
                    $AuthBytes=ConvertFrom-DriveOSPasskeyBase64Url "$($Body.authenticatorData)";$NewCount=Get-DriveOSPasskeySignCount $AuthBytes
                    if($NewCount -gt 0 -and [uint32]$Credential.signCount -gt 0 -and $NewCount -le [uint32]$Credential.signCount){Register-DriveOSLoginFailure -ClientKey $ClientKey;Send-Json -Stream $Stream -StatusCode 401 -StatusText Unauthorized -Object @{error='This passkey could not be verified safely.'};return}
                    $Credential.signCount=$NewCount;$Credential.lastUsedAtUtc=[DateTimeOffset]::UtcNow.ToString('o');Set-DriveOSPasskeyRecord -Repository $Repository -Record $Credential;Clear-DriveOSLoginFailures -ClientKey $ClientKey
                    $Token=New-DriveOSWebSessionToken -OwnerEmail $WebAuthConfig.OwnerEmail -Role owner -Mode full -AuthSecret $WebAuthConfig.AuthSecret -SessionHours $RuntimeConfig.SessionHours
                    Send-Json -Stream $Stream -AdditionalHeaders @{'Set-Cookie'=(New-DriveOSWebSessionCookie -Token $Token -SessionHours $RuntimeConfig.SessionHours)} -Object @{authenticated=$true;role='owner'}
                    return
                }

                "/api/auth/passkey/register/options" {
                    $Challenge=New-DriveOSPasskeyChallenge -Purpose register -ClientKey $ClientKey
                    $Hasher=[Security.Cryptography.SHA256]::Create();try{$UserHash=$Hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($WebAuthConfig.OwnerEmail))}finally{$Hasher.Dispose()};$UserId=ConvertTo-DriveOSPasskeyBase64Url -Bytes $UserHash
                    Send-Json -Stream $Stream -Object @{challengeId=$Challenge.challengeId;challenge=$Challenge.challenge;rpId=([Uri]$RuntimeConfig.PublicUrl).Host;rpName='JourneyDeck';userId=$UserId;userName=$WebAuthConfig.OwnerEmail}
                    return
                }

                "/api/auth/passkey/register/verify" {
                    $Body=ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields challengeId,credentialId,clientDataJSON,authenticatorData,publicKeySpki
                    try{$Challenge=Use-DriveOSPasskeyChallenge -ChallengeId "$($Body.challengeId)" -Purpose register -ClientKey $ClientKey}catch{Send-Json -Stream $Stream -StatusCode 400 -StatusText 'Bad Request' -Object @{error=$_.Exception.Message};return}
                    $Origin=([Uri]$RuntimeConfig.PublicUrl).GetLeftPart([UriPartial]::Authority).TrimEnd('/')
                    $ClientBytes=Test-DriveOSPasskeyClientData -ClientDataJSON "$($Body.clientDataJSON)" -ExpectedType 'webauthn.create' -ExpectedChallenge $Challenge.challenge -ExpectedOrigin $Origin
                    try{$AuthBytes=ConvertFrom-DriveOSPasskeyBase64Url "$($Body.authenticatorData)";$KeyBytes=ConvertFrom-DriveOSPasskeyBase64Url "$($Body.publicKeySpki)";$Ecdsa=New-DriveOSEcdsaFromPasskeySpki -PublicKeySpki $KeyBytes;if(-not $Ecdsa){$ClientBytes=$null}else{$Ecdsa.Dispose()}}catch{$ClientBytes=$null}
                    if(-not $ClientBytes -or -not(Test-DriveOSPasskeyAuthenticatorData -AuthenticatorData $AuthBytes -RpId ([Uri]$RuntimeConfig.PublicUrl).Host) -or "$($Body.credentialId)".Length -gt 1024){Send-Json -Stream $Stream -StatusCode 400 -StatusText 'Bad Request' -Object @{error='Passkey registration could not be verified.'};return}
                    $Record=[PSCustomObject]@{version=1;credentialId="$($Body.credentialId)";publicKeySpki="$($Body.publicKeySpki)";signCount=(Get-DriveOSPasskeySignCount $AuthBytes);transports=@($Body.transports);createdAtUtc=[DateTimeOffset]::UtcNow.ToString('o');lastUsedAtUtc=$null}
                    Set-DriveOSPasskeyRecord -Repository $Repository -Record $Record
                    Send-Json -Stream $Stream -Object @{registered=$true}
                    return
                }

                "/api/auth/passkey/remove" {
                    $Empty=[PSCustomObject]@{version=1;credentialId=$null;removedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')};Set-DriveOSPasskeyRecord -Repository $Repository -Record $Empty
                    Send-Json -Stream $Stream -Object @{registered=$false}
                    return
                }

                "/api/mobility/place" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields nodeId
                    Send-Json -Stream $Stream -Object (Set-MobilityPlacePreference -Repository $Repository -Candidate $Body)
                    return
                }

                "/api/mobility/place-geofence" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields latitude,longitude,radiusFeet,name,category
                    Send-Json -Stream $Stream -Object (Set-MobilityPlaceGeofence -Repository $Repository -Candidate $Body)
                    return
                }

                "/api/mobility/routine" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields routineId,status
                    Send-Json -Stream $Stream -Object (Set-MobilityRoutinePreference -Repository $Repository -Candidate $Body)
                    return
                }

                "/api/collections/save" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields name
                    Send-Json -Stream $Stream -Object (Save-JourneyCollection -Repository $Repository -CollectionId $Body.id -Name $Body.name -Description $Body.description -DriveIds @($Body.driveIds))
                    return
                }

                "/api/collections/delete" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields collectionId
                    Send-Json -Stream $Stream -Object (Remove-JourneyCollection -Repository $Repository -CollectionId $Body.collectionId)
                    return
                }

                "/api/collections/attachments/list" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields collectionId
                    Send-Json -Stream $Stream -Object @{ attachments = @(Get-DriveOSJourneyAttachments -Repository $Repository -CollectionId "$($Body.collectionId)") }
                    return
                }

                "/api/collections/attachments/get" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields attachmentId
                    $Attachment = @(Get-DriveOSJourneyAttachments -Repository $Repository -AttachmentId "$($Body.attachmentId)" -IncludeData) | Select-Object -First 1
                    if (-not $Attachment) { Send-Json -Stream $Stream -StatusCode 404 -StatusText 'Not Found' -Object @{ error='Attachment was not found.' }; return }
                    Send-Json -Stream $Stream -Object $Attachment
                    return
                }

                "/api/collections/attachments/add" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields collectionId,fileName,contentType,dataBase64
                    Send-Json -Stream $Stream -Object (Add-JourneyAttachment -Repository $Repository -CollectionId "$($Body.collectionId)" -FileName "$($Body.fileName)" -ContentType "$($Body.contentType)" -DataBase64 "$($Body.dataBase64)")
                    return
                }

                "/api/collections/attachments/remove" {
                    $Body = ConvertFrom-DriveOSRequestBody -BodyText $BodyText -RequiredFields attachmentId
                    Send-Json -Stream $Stream -Object (Remove-JourneyAttachment -Repository $Repository -AttachmentId "$($Body.attachmentId)")
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

                $WifePostAllowed = $Method -eq "POST" -and $Path -in @("/api/wife/mode", "/api/wife/drive/map", "/api/auth/logout")
                if ($WebPrincipal -and $WebPrincipal.Role -eq "wife" -and $Method -eq "POST" -and -not $IsPublicWebRequest -and -not $WifePostAllowed) {
                    Send-RequestRejected -Stream $Stream -Code 403 -Text "Forbidden" -Message "This feature is only available in owner mode."
                    continue
                }

                if ($WebPrincipal -and $WebPrincipal.Role -eq "wife" -and $WebPrincipal.Mode -ne "full") {
                    $WifeApiAllowed = $Method -eq "GET" -and $Path -in @("/api/auth/session", "/api/wife/summary", "/api/wife/vehicle", "/api/wife/drives", "/api/wife/collections", "/api/wife/music", "/api/wife/live")
                    $WifeApiAllowed = $WifeApiAllowed -or ($Method -eq "POST" -and $Path -in @("/api/wife/mode", "/api/wife/drive/map", "/api/auth/logout"))
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
            $RequestMaxBodyBytes = if ($Method -eq 'POST' -and $Path -eq '/api/collections/attachments/add' -and $WebPrincipal -and $WebPrincipal.Role -eq 'owner') { 3145728 } else { $MaxBodyBytes }

            if ($Headers.ContainsKey("content-length")) {
                if (-not [int]::TryParse(
                    $Headers["content-length"],
                    [ref]$ContentLength
                ) -or
                    $ContentLength -lt 0 -or
                    $ContentLength -gt $RequestMaxBodyBytes) {
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
