$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ServerPath = Join-Path $Root "DriveOS-Server.ps1"
$ConfigPath = Join-Path $Root "src\Configuration\DriveOS.Configuration.psm1"
$RepositoryPath = Join-Path $Root "src\Repositories\DriveOS.Repository.psm1"
$WebRequestPath = Join-Path $Root "src\Security\DriveOS.WebRequest.psm1"
$AppJsPath = Join-Path $Root "web\app.js"
$WebEnvPath = Join-Path $Root "web.env.example"

$SecretModulePath = Join-Path $Root "src\Security\DriveOS.SecretProtection.psm1"
$SecretTestsPath = Join-Path $Root "tests\SecretProtection.Tests.ps1"
$DeploymentTestsPath = Join-Path $Root "tests\WebDeployment.Tests.ps1"
$DockerfilePath = Join-Path $Root "Dockerfile"
$DockerIgnorePath = Join-Path $Root ".dockerignore"
$RenderPath = Join-Path $Root "render.yaml"

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Content
    )

    $Directory = Split-Path -Parent $Path

    if ($Directory -and -not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Read-NormalizedText {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }

    return ([IO.File]::ReadAllText($Path) -replace "`r`n", "`n")
}

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string]$Old,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$New,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if (-not $Text.Contains($Old)) {
        throw "Could not find expected source block: $Description"
    }

    return $Text.Replace($Old, $New)
}

function Replace-RegexOnce {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string]$Pattern,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Replacement,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    $Regex = New-Object Text.RegularExpressions.Regex(
        $Pattern,
        [Text.RegularExpressions.RegexOptions]::Singleline
    )

    $Matches = $Regex.Matches($Text)

    if ($Matches.Count -ne 1) {
        throw "Expected exactly one match for $Description, found $($Matches.Count)."
    }

    return $Regex.Replace($Text, $Replacement, 1)
}

if (-not (Test-Path $ServerPath -PathType Leaf)) {
    throw "Run this script from the DriveOS repository root."
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $Branch = (& git branch --show-current 2>$null).Trim()

    if ($Branch -and $Branch -ne "web-hosting-prep") {
        throw "This patch must be applied on web-hosting-prep. Current branch: $Branch"
    }

    $Changes = @(& git status --porcelain 2>$null)

    if ($Changes.Count -gt 0) {
        throw "Your Git working tree has uncommitted changes. Commit or stash them first."
    }
}

$Server = Read-NormalizedText $ServerPath
$Config = Read-NormalizedText $ConfigPath
$Repository = Read-NormalizedText $RepositoryPath
$WebRequest = Read-NormalizedText $WebRequestPath
$AppJs = Read-NormalizedText $AppJsPath
$WebEnv = Read-NormalizedText $WebEnvPath

# ================================================================
# 1. Render-aware public URL discovery
# ================================================================

$Config = Replace-Exact `
    -Text $Config `
    -Old @'
    $Value = "$($env:DRIVEOS_PUBLIC_URL)".Trim()

    if (-not $Value) {
        return $null
    }
'@ `
    -New @'
    $Value = "$($env:DRIVEOS_PUBLIC_URL)".Trim()

    if (-not $Value -and $env:RENDER_EXTERNAL_URL) {
        $Value = "$($env:RENDER_EXTERNAL_URL)".Trim()
    }

    if (-not $Value) {
        return $null
    }
'@ `
    -Description "Render public URL fallback"

# ================================================================
# 2. Cross-platform repository provider + sqlite executable
# ================================================================

$Repository = Replace-RegexOnce `
    -Text $Repository `
    -Pattern 'function New-DriveOSRepository \{.*?\n\}' `
    -Replacement @'
function New-DriveOSRepository {
    param(
        [Parameter(Mandatory=$true)]
        [string]$DataDirectory,

        [string]$AppRoot=(Split-Path -Parent $DataDirectory),

        [ValidateSet('Auto','Json','SQLite')]
        [string]$Provider='Auto'
    )

    $configPath = Join-Path $DataDirectory 'repository-provider.json'

    if ($Provider -eq 'Auto' -and $env:DRIVEOS_REPOSITORY_PROVIDER) {
        $RequestedProvider = "$($env:DRIVEOS_REPOSITORY_PROVIDER)".Trim()

        if ($RequestedProvider -notin @('Json', 'SQLite')) {
            throw 'DRIVEOS_REPOSITORY_PROVIDER must be Json or SQLite.'
        }

        $Provider = $RequestedProvider
    }

    if ($Provider -eq 'Auto') {
        $Provider = 'Json'

        if (Test-Path -LiteralPath $configPath) {
            try {
                $config = Read-DriveOSJson -Path $configPath

                if ($config.provider -eq 'SQLite') {
                    $Provider = 'SQLite'
                }
            }
            catch {}
        }
    }

    $sqliteExecutable = $null

    if ($IsWindows -or $env:OS -eq 'Windows_NT') {
        $sqliteExecutable = Join-Path $AppRoot 'tools\sqlite\sqlite3.exe'
    }
    else {
        $SqliteCommand = Get-Command sqlite3 -ErrorAction SilentlyContinue

        if ($SqliteCommand) {
            $sqliteExecutable = $SqliteCommand.Source
        }
    }

    if (
        $Provider -eq 'SQLite' -and
        (
            -not $sqliteExecutable -or
            -not (Test-Path -LiteralPath $sqliteExecutable -PathType Leaf)
        )
    ) {
        throw 'SQLite is configured but its runtime is missing.'
    }

    [PSCustomObject]@{
        Provider = $Provider
        DataDirectory = $DataDirectory
        SpotifyHistoryPath = Join-Path $DataDirectory 'spotify-history.jsonl'
        PlaceAliasesPath = Join-Path $DataDirectory 'place-aliases.json'
        ChargingSettingsPath = Join-Path $DataDirectory 'charging-settings.json'
        ConfigPath = $configPath
        DatabasePath = Join-Path $DataDirectory 'driveos.db'
        SqliteExecutable = $sqliteExecutable
    }
}
'@ `
    -Description "repository constructor"

# ================================================================
# 3. Mode-aware secret protection module
# ================================================================

$SecretModule = @'
Set-StrictMode -Version 2.0

function Test-DriveOSSecretFixedTimeBytes {
    param(
        [Parameter(Mandatory=$true)][byte[]]$Left,
        [Parameter(Mandatory=$true)][byte[]]$Right
    )

    if ($Left.Length -ne $Right.Length) {
        return $false
    }

    $Difference = 0

    for ($Index = 0; $Index -lt $Left.Length; $Index++) {
        $Difference = $Difference -bor (
            $Left[$Index] -bxor $Right[$Index]
        )
    }

    return ($Difference -eq 0)
}

function Get-DriveOSDerivedSecretKey {
    param(
        [Parameter(Mandatory=$true)][byte[]]$MasterKey,
        [Parameter(Mandatory=$true)][string]$Purpose
    )

    if ($MasterKey.Length -ne 32) {
        throw "DriveOS web encryption key must contain exactly 32 bytes."
    }

    $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MasterKey)

    try {
        return $Hmac.ComputeHash(
            [Text.Encoding]::UTF8.GetBytes(
                "DriveOS secret protection v1: $Purpose"
            )
        )
    }
    finally {
        $Hmac.Dispose()
    }
}

function Protect-DriveOSSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PlainText,

        [Parameter(Mandatory=$true)]
        [ValidateSet("desktop","web")]
        [string]$Mode,

        [byte[]]$EncryptionKey
    )

    if ($Mode -eq "desktop") {
        return $PlainText |
            ConvertTo-SecureString -AsPlainText -Force |
            ConvertFrom-SecureString
    }

    if (-not $EncryptionKey -or $EncryptionKey.Length -ne 32) {
        throw "DriveOS web encryption key is missing or invalid."
    }

    $EncryptionSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "encryption"

    $MacSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "authentication"

    $Aes = [Security.Cryptography.Aes]::Create()
    $Aes.KeySize = 256
    $Aes.BlockSize = 128
    $Aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $Aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $Aes.Key = $EncryptionSubkey
    $Aes.GenerateIV()

    try {
        $Encryptor = $Aes.CreateEncryptor()

        try {
            $PlainBytes = [Text.Encoding]::UTF8.GetBytes($PlainText)
            $CipherBytes = $Encryptor.TransformFinalBlock(
                $PlainBytes,
                0,
                $PlainBytes.Length
            )
        }
        finally {
            $Encryptor.Dispose()
        }

        $IvBytes = $Aes.IV
        $AuthenticatedBytes = [byte[]]($IvBytes + $CipherBytes)

        $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MacSubkey)

        try {
            $MacBytes = $Hmac.ComputeHash($AuthenticatedBytes)
        }
        finally {
            $Hmac.Dispose()
        }

        return "webv1:{0}:{1}:{2}" -f `
            [Convert]::ToBase64String($IvBytes), `
            [Convert]::ToBase64String($CipherBytes), `
            [Convert]::ToBase64String($MacBytes)
    }
    finally {
        $Aes.Dispose()
    }
}

function Unprotect-DriveOSSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProtectedText,

        [Parameter(Mandatory=$true)]
        [ValidateSet("desktop","web")]
        [string]$Mode,

        [byte[]]$EncryptionKey
    )

    if ($Mode -eq "desktop") {
        $SecureString = ConvertTo-SecureString $ProtectedText
        $Pointer = [IntPtr]::Zero

        try {
            $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
                $SecureString
            )

            return [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                $Pointer
            )
        }
        finally {
            if ($Pointer -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
            }
        }
    }

    if (-not $EncryptionKey -or $EncryptionKey.Length -ne 32) {
        throw "DriveOS web encryption key is missing or invalid."
    }

    $Parts = $ProtectedText.Split(':')

    if ($Parts.Count -ne 4 -or $Parts[0] -ne "webv1") {
        throw "DriveOS web secret has an unsupported format."
    }

    try {
        $IvBytes = [Convert]::FromBase64String($Parts[1])
        $CipherBytes = [Convert]::FromBase64String($Parts[2])
        $ProvidedMac = [Convert]::FromBase64String($Parts[3])
    }
    catch {
        throw "DriveOS web secret is malformed."
    }

    if ($IvBytes.Length -ne 16 -or $ProvidedMac.Length -ne 32) {
        throw "DriveOS web secret is malformed."
    }

    $EncryptionSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "encryption"

    $MacSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "authentication"

    $AuthenticatedBytes = [byte[]]($IvBytes + $CipherBytes)
    $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MacSubkey)

    try {
        $ExpectedMac = $Hmac.ComputeHash($AuthenticatedBytes)
    }
    finally {
        $Hmac.Dispose()
    }

    if (-not (
        Test-DriveOSSecretFixedTimeBytes `
            -Left $ExpectedMac `
            -Right $ProvidedMac
    )) {
        throw "DriveOS web secret authentication failed."
    }

    $Aes = [Security.Cryptography.Aes]::Create()
    $Aes.KeySize = 256
    $Aes.BlockSize = 128
    $Aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $Aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $Aes.Key = $EncryptionSubkey
    $Aes.IV = $IvBytes

    try {
        $Decryptor = $Aes.CreateDecryptor()

        try {
            $PlainBytes = $Decryptor.TransformFinalBlock(
                $CipherBytes,
                0,
                $CipherBytes.Length
            )
        }
        finally {
            $Decryptor.Dispose()
        }

        return [Text.Encoding]::UTF8.GetString($PlainBytes)
    }
    finally {
        $Aes.Dispose()
    }
}

Export-ModuleMember -Function `
    Protect-DriveOSSecret, `
    Unprotect-DriveOSSecret
'@

# ================================================================
# 4. Server secret protection + SQLite initialization
# ================================================================

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebRequest.psm1") -Force
'@ `
    -New @'
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebRequest.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.SecretProtection.psm1") -Force
'@ `
    -Description "secret protection import"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
$SpotifyTokenFile = Join-Path $DataDirectory "spotify-token.json"
$SpotifyHistoryFile = Join-Path $DataDirectory "spotify-history.jsonl"
'@ `
    -New @'
$SpotifyTokenFile = Join-Path $DataDirectory "spotify-token.json"
$SpotifyOAuthStateFile = Join-Path $DataDirectory "spotify-oauth-state.json"
$SpotifyHistoryFile = Join-Path $DataDirectory "spotify-history.jsonl"
'@ `
    -Description "Spotify OAuth state file"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

if (-not $MaintenanceMode -and -not $env:TESSIE_TOKEN) {
'@ `
    -New @'
if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

if ($Repository.Provider -eq "SQLite") {
    Initialize-DriveOSSqlite -Repository $Repository
}

if (-not $MaintenanceMode -and -not $env:TESSIE_TOKEN) {
'@ `
    -Description "SQLite initialization"

$Server = Replace-RegexOnce `
    -Text $Server `
    -Pattern 'function Unprotect-Token \{.*?function Protect-Token \{.*?\n\}' `
    -Replacement @'
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
'@ `
    -Description "mode-aware token protection"

# ================================================================
# 5. Hosted Spotify PKCE OAuth
# ================================================================

$SpotifyFunctions = @'
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

    Write-DriveOSJson `
        -Path $SpotifyOAuthStateFile `
        -Value ([PSCustomObject]@{
            state = $State
            verifier = Protect-Token $CodeVerifier
            redirectUri = $RedirectUri
            expiresAt = [DateTimeOffset]::UtcNow.
                AddMinutes(10).
                ToString("o")
        })

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

    if (-not (Test-Path $SpotifyOAuthStateFile -PathType Leaf)) {
        throw "Spotify authorization state was not found or has expired."
    }

    $Pending = Read-DriveOSJson -Path $SpotifyOAuthStateFile

    $ExpiresAt = [DateTimeOffset]::Parse(
        "$($Pending.expiresAt)"
    )

    if ([DateTimeOffset]::UtcNow -ge $ExpiresAt) {
        Remove-Item $SpotifyOAuthStateFile -Force -ErrorAction SilentlyContinue
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

    Remove-Item `
        $SpotifyOAuthStateFile `
        -Force `
        -ErrorAction SilentlyContinue
}

'@

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Start-SpotifyAuthorization {
'@ `
    -New ($SpotifyFunctions + @'
function Start-SpotifyAuthorization {
'@) `
    -Description "hosted Spotify functions"

$Server = Replace-RegexOnce `
    -Text $Server `
    -Pattern 'function Start-SpotifyAuthorization \{.*?\n\}' `
    -Replacement @'
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
'@ `
    -Description "mode-aware Spotify authorization"

# Router accepts Target.
$Server = Replace-Exact `
    -Text $Server `
    -Old @'
        [string]$Path,
        [string]$BodyText,
        [hashtable]$Headers,
'@ `
    -New @'
        [string]$Path,
        [string]$Target,
        [string]$BodyText,
        [hashtable]$Headers,
'@ `
    -Description "router Target parameter"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
                "/login" {
                    Send-StaticFile `
                        -Stream $Stream `
                        -RequestPath "/login.html"
                    return
                }

                "/api/auth/session" {
'@ `
    -New @'
                "/login" {
                    Send-StaticFile `
                        -Stream $Stream `
                        -RequestPath "/login.html"
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
'@ `
    -Description "Spotify callback route"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
                -Method $Method `
                -Path $Path `
                -BodyText $BodyText `
'@ `
    -New @'
                -Method $Method `
                -Path $Path `
                -Target $Target `
                -BodyText $BodyText `
'@ `
    -Description "pass Target to router"

# ================================================================
# 6. Public callback route + environment-backed optional services
# ================================================================

$WebRequest = Replace-Exact `
    -Text $WebRequest `
    -Old @'
            "/login.html",
            "/login.js"
'@ `
    -New @'
            "/login.html",
            "/login.js",
            "/auth/spotify/callback"
'@ `
    -Description "public Spotify callback"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Get-LastFmConfiguration {
    if (-not (Test-Path $LastFmConfigFile -PathType Leaf)) {
        return $null
    }
'@ `
    -New @'
function Get-LastFmConfiguration {
    if (
        $RuntimeConfig.IsWeb -and
        $env:LASTFM_USERNAME -and
        $env:LASTFM_API_KEY
    ) {
        return [PSCustomObject]@{
            username = "$($env:LASTFM_USERNAME)".Trim()
            apiKey = "$($env:LASTFM_API_KEY)".Trim()
        }
    }

    if (-not (Test-Path $LastFmConfigFile -PathType Leaf)) {
        return $null
    }
'@ `
    -Description "web Last.fm environment configuration"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Start-LastFmConfiguration {
    $Script = Join-Path $PSScriptRoot "Connect-LastFm.ps1"
'@ `
    -New @'
function Start-LastFmConfiguration {
    if ($RuntimeConfig.IsWeb) {
        throw "Configure LASTFM_USERNAME and LASTFM_API_KEY in the hosting environment."
    }

    $Script = Join-Path $PSScriptRoot "Connect-LastFm.ps1"
'@ `
    -Description "web Last.fm setup guard"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Get-FoursquareConfiguration {
    if (-not (Test-Path $FoursquareConfigFile -PathType Leaf)) { return $null }

    $Config = Read-DriveOSJson -Path $FoursquareConfigFile
'@ `
    -New @'
function Get-FoursquareConfiguration {
    if ($RuntimeConfig.IsWeb -and $env:FOURSQUARE_API_KEY) {
        $ApiKey = "$($env:FOURSQUARE_API_KEY)".Trim()
        $script:FoursquareApiKeyForRedaction = $ApiKey
        return [PSCustomObject]@{ apiKey = $ApiKey }
    }

    if (-not (Test-Path $FoursquareConfigFile -PathType Leaf)) { return $null }

    $Config = Read-DriveOSJson -Path $FoursquareConfigFile
'@ `
    -Description "web Foursquare environment configuration"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Start-FoursquareConfiguration {
    $Script = Join-Path $PSScriptRoot "Connect-Foursquare.ps1"
'@ `
    -New @'
function Start-FoursquareConfiguration {
    if ($RuntimeConfig.IsWeb) {
        throw "Configure FOURSQUARE_API_KEY in the hosting environment."
    }

    $Script = Join-Path $PSScriptRoot "Connect-Foursquare.ps1"
'@ `
    -Description "web Foursquare setup guard"

# ================================================================
# 7. Browser Spotify flow
# ================================================================

$AppJs = Replace-Exact `
    -Text $AppJs `
    -Old @'
    await postJson("/api/spotify/connect", {});
    setText("archiveAdded", "Finish authorization in your browser\u2026");

    // The authorization script runs separately and writes spotify-token.json.
'@ `
    -New @'
    const authorization = await postJson("/api/spotify/connect", {});

    if (authorization?.authorizationUrl) {
      setText("archiveAdded", "Opening Spotify authorization\u2026");
      window.location.assign(authorization.authorizationUrl);
      return;
    }

    setText("archiveAdded", "Finish authorization in your browser\u2026");

    // Desktop authorization runs separately and writes spotify-token.json.
'@ `
    -Description "browser Spotify redirect"

# ================================================================
# 8. Example environment contract
# ================================================================

if (-not $WebEnv.Contains("DRIVEOS_REPOSITORY_PROVIDER=")) {
    $WebEnv = $WebEnv.Replace(
        "DRIVEOS_DATA_DIR=/app/data",
        "DRIVEOS_DATA_DIR=/app/data`nDRIVEOS_REPOSITORY_PROVIDER=SQLite"
    )
}

$WebEnv = $WebEnv.Replace(
    "# Public URL`n# Example after deployment:`n# DRIVEOS_PUBLIC_URL=https://driveos-example.onrender.com`nDRIVEOS_PUBLIC_URL=",
    "# Public URL`n# Optional on Render: DriveOS automatically uses RENDER_EXTERNAL_URL.`n# Set this explicitly for a custom domain.`nDRIVEOS_PUBLIC_URL="
)

# ================================================================
# 9. Docker + Render Blueprint
# ================================================================

$Dockerfile = @'
FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

ENV DRIVEOS_MODE=web
ENV DRIVEOS_DATA_DIR=/app/data
ENV DRIVEOS_REPOSITORY_PROVIDER=SQLite

EXPOSE 10000

CMD ["pwsh", "-NoLogo", "-NoProfile", "-File", "./DriveOS-Server.ps1"]
'@

$DockerIgnore = @'
.git
.gitignore
.env
.env.*
data
logs
*.log
desktop/bin
desktop/obj
**/*.user
**/*.suo
'@

$RenderYaml = @'
services:
  - type: web
    name: driveos
    runtime: docker
    branch: web-hosting-prep
    autoDeployTrigger: commit
    healthCheckPath: /healthz
    disk:
      name: driveos-data
      mountPath: /app/data
      sizeGB: 1
    envVars:
      - key: DRIVEOS_MODE
        value: web
      - key: DRIVEOS_DATA_DIR
        value: /app/data
      - key: DRIVEOS_REPOSITORY_PROVIDER
        value: SQLite
      - key: DRIVEOS_SESSION_HOURS
        value: "24"
      - key: DRIVEOS_OWNER_EMAIL
        sync: false
      - key: DRIVEOS_PASSWORD_HASH
        sync: false
      - key: DRIVEOS_AUTH_SECRET
        generateValue: true
      - key: DRIVEOS_ENCRYPTION_KEY
        generateValue: true
      - key: TESSIE_TOKEN
        sync: false
      - key: SPOTIFY_CLIENT_ID
        sync: false
      - key: LASTFM_USERNAME
        sync: false
      - key: LASTFM_API_KEY
        sync: false
      - key: FOURSQUARE_API_KEY
        sync: false
'@

# ================================================================
# 10. Tests
# ================================================================

$SecretTests = @'
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ModulePath = Join-Path `
    $Root `
    "src\Security\DriveOS.SecretProtection.psm1"

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

Import-Module $ModulePath -Force

$Key = New-Object byte[] 32
$Random = [Security.Cryptography.RandomNumberGenerator]::Create()

try {
    $Random.GetBytes($Key)
}
finally {
    $Random.Dispose()
}

$PlainText = "DriveOS secret test value"
$Protected = Protect-DriveOSSecret `
    -PlainText $PlainText `
    -Mode web `
    -EncryptionKey $Key

Assert-True `
    ($Protected -match '^webv1:') `
    "Web secret should use the versioned protected format."

Assert-True `
    ($Protected -notmatch [regex]::Escape($PlainText)) `
    "Protected web secret must not contain plaintext."

$RoundTrip = Unprotect-DriveOSSecret `
    -ProtectedText $Protected `
    -Mode web `
    -EncryptionKey $Key

Assert-True `
    ($RoundTrip -eq $PlainText) `
    "Web secret encryption round trip failed."

$Parts = $Protected.Split(':')
$Mac = [Convert]::FromBase64String($Parts[3])
$Mac[0] = $Mac[0] -bxor 1
$Parts[3] = [Convert]::ToBase64String($Mac)
$Tampered = $Parts -join ':'

$TamperRejected = $false

try {
    $null = Unprotect-DriveOSSecret `
        -ProtectedText $Tampered `
        -Mode web `
        -EncryptionKey $Key
}
catch {
    $TamperRejected = $true
}

Assert-True `
    $TamperRejected `
    "Tampered encrypted secrets must be rejected."

Write-Host `
    "DriveOS secret protection checks passed." `
    -ForegroundColor Green
'@

$DeploymentTests = @'
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

$Server = Get-Content `
    (Join-Path $Root "DriveOS-Server.ps1") `
    -Raw

$Config = Get-Content `
    (Join-Path $Root "src\Configuration\DriveOS.Configuration.psm1") `
    -Raw

$Repository = Get-Content `
    (Join-Path $Root "src\Repositories\DriveOS.Repository.psm1") `
    -Raw

$App = Get-Content `
    (Join-Path $Root "web\app.js") `
    -Raw

Assert-True `
    (Test-Path (Join-Path $Root "Dockerfile")) `
    "Dockerfile is missing."

Assert-True `
    (Test-Path (Join-Path $Root "render.yaml")) `
    "Render Blueprint is missing."

Assert-True `
    ($Config -match 'RENDER_EXTERNAL_URL') `
    "Render public URL fallback is missing."

Assert-True `
    ($Repository -match 'Get-Command sqlite3') `
    "Linux SQLite executable discovery is missing."

Assert-True `
    ($Server -match 'Initialize-DriveOSSqlite') `
    "Web SQLite initialization is missing."

Assert-True `
    ($Server -match 'Start-SpotifyWebAuthorization') `
    "Hosted Spotify authorization is missing."

Assert-True `
    ($Server -match 'Complete-SpotifyWebAuthorization') `
    "Hosted Spotify OAuth callback is missing."

Assert-True `
    ($Server -match '/auth/spotify/callback') `
    "Hosted Spotify callback route is missing."

Assert-True `
    ($Server -match 'code_challenge_method=S256') `
    "Spotify PKCE S256 challenge is missing."

Assert-True `
    ($Server -match 'code_verifier') `
    "Spotify PKCE verifier exchange is missing."

Assert-True `
    ($App -match 'authorizationUrl') `
    "Browser Spotify redirect handling is missing."

$Render = Get-Content `
    (Join-Path $Root "render.yaml") `
    -Raw

Assert-True `
    ($Render -match 'healthCheckPath:\s*/healthz') `
    "Render health check is not configured."

Assert-True `
    ($Render -match 'mountPath:\s*/app/data') `
    "Render persistent data disk is not configured."

Assert-True `
    ($Render -match 'DRIVEOS_PASSWORD_HASH[\s\S]{0,80}sync:\s*false') `
    "Password hash must remain a private Render environment value."

Assert-True `
    ($Render -match 'DRIVEOS_AUTH_SECRET[\s\S]{0,80}generateValue:\s*true') `
    "Render must generate the authentication secret."

Assert-True `
    ($Render -match 'DRIVEOS_ENCRYPTION_KEY[\s\S]{0,80}generateValue:\s*true') `
    "Render must generate the encryption key."

Write-Host `
    "DriveOS web deployment checks passed." `
    -ForegroundColor Green
'@

# ================================================================
# 11. Validation before writes
# ================================================================

foreach ($Required in @(
    "Start-SpotifyWebAuthorization",
    "Complete-SpotifyWebAuthorization",
    "DriveOS.SecretProtection.psm1",
    "Initialize-DriveOSSqlite",
    "authorizationUrl"
)) {
    if (-not ($Server.Contains($Required) -or $AppJs.Contains($Required))) {
        throw "Patch validation failed; missing expected feature: $Required"
    }
}

# ================================================================
# 12. Write everything
# ================================================================

Write-Utf8NoBom -Path $ConfigPath -Content $Config
Write-Utf8NoBom -Path $RepositoryPath -Content $Repository
Write-Utf8NoBom -Path $ServerPath -Content $Server
Write-Utf8NoBom -Path $WebRequestPath -Content $WebRequest
Write-Utf8NoBom -Path $AppJsPath -Content $AppJs
Write-Utf8NoBom -Path $WebEnvPath -Content $WebEnv
Write-Utf8NoBom -Path $SecretModulePath -Content $SecretModule
Write-Utf8NoBom -Path $SecretTestsPath -Content $SecretTests
Write-Utf8NoBom -Path $DeploymentTestsPath -Content $DeploymentTests
Write-Utf8NoBom -Path $DockerfilePath -Content $Dockerfile
Write-Utf8NoBom -Path $DockerIgnorePath -Content $DockerIgnore
Write-Utf8NoBom -Path $RenderPath -Content $RenderYaml

Write-Host ""
Write-Host "DriveOS hosted OAuth + deployment batch applied." -ForegroundColor Green
Write-Host ""
Write-Host "Run:"
Write-Host "  .\tests\WebHostingPrep.Tests.ps1"
Write-Host "  .\tests\WebAuth.Tests.ps1"
Write-Host "  .\tests\WebSession.Tests.ps1"
Write-Host "  .\tests\WebRequest.Tests.ps1"
Write-Host "  .\tests\SecretProtection.Tests.ps1"
Write-Host "  .\tests\WebDeployment.Tests.ps1"
