$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path

$ServerPath = Join-Path $Root "DriveOS-Server.ps1"
$RepositoryPath = Join-Path $Root "src\Repositories\DriveOS.Repository.psm1"
$TursoPath = Join-Path $Root "src\Storage\DriveOS.Turso.psm1"
$RenderPath = Join-Path $Root "render.yaml"
$DockerfilePath = Join-Path $Root "Dockerfile"
$WebEnvPath = Join-Path $Root "web.env.example"
$TursoTestsPath = Join-Path $Root "tests\Turso.Tests.ps1"
$DeploymentTestsPath = Join-Path $Root "tests\WebDeployment.Tests.ps1"

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Content
    )

    $Directory = Split-Path -Parent $Path

    if ($Directory -and -not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Read-Normalized {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path $Path -PathType Leaf)) {
        throw "Required file not found: $Path"
    }

    return ([IO.File]::ReadAllText($Path) -replace "`r`n", "`n")
}

function Replace-Exact {
    param(
        [Parameter(Mandatory=$true)][string]$Text,
        [Parameter(Mandatory=$true)][string]$Old,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$New,
        [Parameter(Mandatory=$true)][string]$Description
    )

    if (-not $Text.Contains($Old)) {
        throw "Could not find expected block: $Description"
    }

    return $Text.Replace($Old, $New)
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

$Server = Read-Normalized $ServerPath
$WebEnv = Read-Normalized $WebEnvPath

$TursoModule = @'
Set-StrictMode -Version 2.0

function Get-DriveOSTursoHttpUrl {
    param([Parameter(Mandatory=$true)][string]$DatabaseUrl)

    $Value = "$DatabaseUrl".Trim()

    if ($Value -notmatch '^libsql://([A-Za-z0-9.-]+)(?::\d+)?/?$') {
        throw "TURSO_DATABASE_URL must be a valid libsql:// Turso database URL."
    }

    return "https://$($Matches[1])"
}

function New-DriveOSTursoTextArgument {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return [PSCustomObject]@{ type = "null" }
    }

    return [PSCustomObject]@{
        type = "text"
        value = "$Value"
    }
}

function Invoke-DriveOSTursoPipeline {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][object[]]$Statements
    )

    if (-not $Repository.TursoDatabaseUrl -or -not $Repository.TursoAuthToken) {
        throw "Turso repository credentials are incomplete."
    }

    $BaseUrl = Get-DriveOSTursoHttpUrl -DatabaseUrl $Repository.TursoDatabaseUrl
    $Requests = New-Object System.Collections.Generic.List[object]

    foreach ($Statement in $Statements) {
        $Stmt = [ordered]@{ sql = "$($Statement.Sql)" }

        if ($Statement.PSObject.Properties["Args"]) {
            $Stmt.args = @(
                $Statement.Args | ForEach-Object {
                    New-DriveOSTursoTextArgument -Value $_
                }
            )
        }

        $Requests.Add([PSCustomObject]@{
            type = "execute"
            stmt = [PSCustomObject]$Stmt
        })
    }

    $Requests.Add([PSCustomObject]@{ type = "close" })

    $Payload = [PSCustomObject]@{
        requests = @($Requests)
    } | ConvertTo-Json -Depth 20 -Compress

    $Response = Invoke-RestMethod `
        -Uri "$BaseUrl/v2/pipeline" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $($Repository.TursoAuthToken)" } `
        -ContentType "application/json" `
        -Body $Payload

    $ExecuteResults = @()

    for ($Index = 0; $Index -lt $Statements.Count; $Index++) {
        $Result = $Response.results[$Index]

        if (-not $Result -or $Result.type -ne "ok") {
            $Message = "Turso query failed."

            if (
                $Result -and
                $Result.PSObject.Properties["error"] -and
                $Result.error.message
            ) {
                $Message = "Turso query failed: $($Result.error.message)"
            }

            throw $Message
        }

        $ExecuteResults += $Result.response.result
    }

    return @($ExecuteResults)
}

function ConvertFrom-DriveOSTursoResultRows {
    param([Parameter(Mandatory=$true)]$Result)

    $Columns = @($Result.cols | ForEach-Object { "$($_.name)" })
    $Objects = @()

    foreach ($Row in @($Result.rows)) {
        $Values = [ordered]@{}

        for ($Index = 0; $Index -lt $Columns.Count; $Index++) {
            $Cell = $Row[$Index]

            if ($null -eq $Cell -or $Cell.type -eq "null") {
                $Values[$Columns[$Index]] = $null
            }
            elseif ($Cell.PSObject.Properties["value"]) {
                $Values[$Columns[$Index]] = $Cell.value
            }
            elseif ($Cell.PSObject.Properties["base64"]) {
                $Values[$Columns[$Index]] = $Cell.base64
            }
            else {
                $Values[$Columns[$Index]] = $null
            }
        }

        $Objects += [PSCustomObject]$Values
    }

    return @($Objects)
}

function Invoke-DriveOSTursoQuery {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Sql,
        [object[]]$Args = @()
    )

    $Statement = [PSCustomObject]@{
        Sql = $Sql
        Args = @($Args)
    }

    $Results = @(Invoke-DriveOSTursoPipeline -Repository $Repository -Statements @($Statement))

    if (-not $Results.Count) {
        return @()
    }

    return @(ConvertFrom-DriveOSTursoResultRows -Result $Results[0])
}

function Invoke-DriveOSTursoExecute {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Sql,
        [object[]]$Args = @()
    )

    $Statement = [PSCustomObject]@{
        Sql = $Sql
        Args = @($Args)
    }

    $null = Invoke-DriveOSTursoPipeline -Repository $Repository -Statements @($Statement)
}

function Initialize-DriveOSTurso {
    param([Parameter(Mandatory=$true)]$Repository)

    $Statements = @(
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS listening_history(id TEXT PRIMARY KEY, played_at TEXT, payload_json TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE INDEX IF NOT EXISTS ix_listening_history_played_at ON listening_history(played_at);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS place_aliases(location TEXT PRIMARY KEY, label TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS app_state(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);" }
    )

    $null = Invoke-DriveOSTursoPipeline -Repository $Repository -Statements $Statements
}

function Get-DriveOSTursoHistory {
    param([Parameter(Mandatory=$true)]$Repository)

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT payload_json FROM listening_history ORDER BY played_at,id;")

    return @($Rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Add-DriveOSTursoHistoryRecord {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Record
    )

    $Payload = $Record | ConvertTo-Json -Depth 20 -Compress

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES(?,?,?);" `
        -Args @("$($Record.id)", "$($Record.played_at)", $Payload)
}

function Get-DriveOSTursoAliases {
    param([Parameter(Mandatory=$true)]$Repository)

    return @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT location,label FROM place_aliases ORDER BY location;")
}

function Set-DriveOSTursoAliases {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][object[]]$Entries
    )

    $Statements = New-Object System.Collections.Generic.List[object]
    $Statements.Add([PSCustomObject]@{ Sql = "BEGIN IMMEDIATE;" })
    $Statements.Add([PSCustomObject]@{ Sql = "DELETE FROM place_aliases;" })

    foreach ($Entry in @($Entries)) {
        $Statements.Add([PSCustomObject]@{
            Sql = "INSERT INTO place_aliases(location,label) VALUES(?,?);"
            Args = @("$($Entry.location)", "$($Entry.label)")
        })
    }

    $Statements.Add([PSCustomObject]@{ Sql = "COMMIT;" })

    $null = Invoke-DriveOSTursoPipeline `
        -Repository $Repository `
        -Statements @($Statements)
}

function Get-DriveOSTursoSettings {
    param([Parameter(Mandatory=$true)]$Repository)

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT value_json FROM settings WHERE key='charging';")

    if (-not $Rows.Count) {
        return $null
    }

    return $Rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSTursoSettings {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Settings
    )

    $Payload = $Settings | ConvertTo-Json -Depth 20 -Compress

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT INTO settings(key,value_json) VALUES('charging',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json;" `
        -Args @($Payload)
}

function Get-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key
    )

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT value_json FROM app_state WHERE key=?;" `
        -Args @($Key))

    if (-not $Rows.Count) {
        return $null
    }

    return $Rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key,
        [Parameter(Mandatory=$true)]$Value
    )

    $Payload = $Value | ConvertTo-Json -Depth 20 -Compress
    $UpdatedAt = [DateTimeOffset]::UtcNow.ToString("o")

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT INTO app_state(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;" `
        -Args @($Key, $Payload, $UpdatedAt)
}

function Remove-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key
    )

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "DELETE FROM app_state WHERE key=?;" `
        -Args @($Key)
}

Export-ModuleMember -Function `
    Get-DriveOSTursoHttpUrl, `
    Invoke-DriveOSTursoPipeline, `
    Initialize-DriveOSTurso, `
    Get-DriveOSTursoHistory, `
    Add-DriveOSTursoHistoryRecord, `
    Get-DriveOSTursoAliases, `
    Set-DriveOSTursoAliases, `
    Get-DriveOSTursoSettings, `
    Set-DriveOSTursoSettings, `
    Get-DriveOSTursoState, `
    Set-DriveOSTursoState, `
    Remove-DriveOSTursoState
'@

$RepositoryModule = @'
Set-StrictMode -Version 2.0

function New-DriveOSRepository {
    param(
        [Parameter(Mandatory=$true)][string]$DataDirectory,
        [string]$AppRoot=(Split-Path -Parent $DataDirectory),
        [ValidateSet('Auto','Json','SQLite','Turso')][string]$Provider='Auto'
    )

    $configPath = Join-Path $DataDirectory 'repository-provider.json'

    if ($Provider -eq 'Auto' -and $env:DRIVEOS_REPOSITORY_PROVIDER) {
        $RequestedProvider = "$($env:DRIVEOS_REPOSITORY_PROVIDER)".Trim()

        if ($RequestedProvider -notin @('Json','SQLite','Turso')) {
            throw 'DRIVEOS_REPOSITORY_PROVIDER must be Json, SQLite, or Turso.'
        }

        $Provider = $RequestedProvider
    }

    if ($Provider -eq 'Auto') {
        $Provider = 'Json'

        if (Test-Path -LiteralPath $configPath) {
            try {
                $config = Read-DriveOSJson -Path $configPath

                if ($config.provider -in @('SQLite','Turso')) {
                    $Provider = "$($config.provider)"
                }
            }
            catch {}
        }
    }

    $sqliteExecutable = $null

    if ($Provider -eq 'SQLite') {
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
            -not $sqliteExecutable -or
            -not (Test-Path -LiteralPath $sqliteExecutable -PathType Leaf)
        ) {
            throw 'SQLite is configured but its runtime is missing.'
        }
    }

    $TursoDatabaseUrl = $null
    $TursoAuthToken = $null

    if ($Provider -eq 'Turso') {
        $TursoDatabaseUrl = "$($env:TURSO_DATABASE_URL)".Trim()
        $TursoAuthToken = "$($env:TURSO_AUTH_TOKEN)".Trim()

        if (-not $TursoDatabaseUrl) {
            throw 'TURSO_DATABASE_URL is required for the Turso repository.'
        }

        if (-not $TursoAuthToken) {
            throw 'TURSO_AUTH_TOKEN is required for the Turso repository.'
        }

        $null = Get-DriveOSTursoHttpUrl -DatabaseUrl $TursoDatabaseUrl
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
        TursoDatabaseUrl = $TursoDatabaseUrl
        TursoAuthToken = $TursoAuthToken
    }
}

function Get-DriveOSListeningHistory {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteHistory -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoHistory -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJsonLines -Path $Repository.SpotifyHistoryPath)
}

function Add-DriveOSListeningHistoryRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Record)

    if ($Repository.Provider -eq 'SQLite') {
        Add-DriveOSSqliteHistoryRecord -Repository $Repository -Record $Record
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Add-DriveOSTursoHistoryRecord -Repository $Repository -Record $Record
        return
    }

    Assert-JsonRepository $Repository
    Add-DriveOSJsonLine -Path $Repository.SpotifyHistoryPath -Value $Record
}

function Get-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteAliases -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoAliases -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.PlaceAliasesPath -Default @())
}

function Set-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)][object[]]$Entries)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteAliases -Repository $Repository -Entries $Entries
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoAliases -Repository $Repository -Entries $Entries
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.PlaceAliasesPath -Value @($Entries)
}

function Get-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return Get-DriveOSSqliteSettings -Repository $Repository
    }

    if ($Repository.Provider -eq 'Turso') {
        return Get-DriveOSTursoSettings -Repository $Repository
    }

    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.ChargingSettingsPath
}

function Set-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Settings)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteSettings -Repository $Repository -Settings $Settings
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoSettings -Repository $Repository -Settings $Settings
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.ChargingSettingsPath -Value $Settings
}

function Assert-JsonRepository {
    param($Repository)

    if (-not $Repository -or $Repository.Provider -ne 'Json') {
        throw 'The configured DriveOS repository provider is not supported by this build.'
    }
}

Export-ModuleMember -Function `
    New-DriveOSRepository, `
    Get-DriveOSListeningHistory, `
    Add-DriveOSListeningHistoryRecord, `
    Get-DriveOSPlaceAliases, `
    Set-DriveOSPlaceAliases, `
    Get-DriveOSChargingSettingsRecord, `
    Set-DriveOSChargingSettingsRecord
'@

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Sqlite.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Repositories\DriveOS.Repository.psm1") -Force
'@ `
    -New @'
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Sqlite.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Storage\DriveOS.Turso.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Repositories\DriveOS.Repository.psm1") -Force
'@ `
    -Description "Turso storage import"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
if ($Repository.Provider -eq "SQLite") {
    Initialize-DriveOSSqlite -Repository $Repository
}
'@ `
    -New @'
if ($Repository.Provider -eq "SQLite") {
    Initialize-DriveOSSqlite -Repository $Repository
}
elseif ($Repository.Provider -eq "Turso") {
    Initialize-DriveOSTurso -Repository $Repository
}
'@ `
    -Description "Turso initialization"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
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
'@ `
    -New @'
    $TokenCache = [PSCustomObject]@{
        AccessToken  = Protect-Token $AccessToken
        RefreshToken = Protect-Token $RefreshToken
        ExpiresAt    = (Get-Date).AddSeconds($ExpiresIn).ToString("o")
        Scope        = $Scope
    }

    if ($Repository.Provider -eq "Turso") {
        Set-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-token" `
            -Value $TokenCache
        return
    }

    Write-DriveOSJson -Path $SpotifyTokenFile -Value $TokenCache
}

function Get-SpotifyTokenCache {
    if ($Repository.Provider -eq "Turso") {
        $Stored = Get-DriveOSTursoState `
            -Repository $Repository `
            -Key "spotify-token"

        if (-not $Stored) {
            throw "Spotify authorization is not configured."
        }

        return $Stored
    }

    if (-not (Test-Path $SpotifyTokenFile)) {
        throw "Spotify token file not found. Run Connect-Spotify.ps1."
    }

    return Read-DriveOSJson -Path $SpotifyTokenFile
}
'@ `
    -Description "Spotify token persistence"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
    return [PSCustomObject]@{
        authorized = $Authorized
        tokenFile  = (Test-Path $SpotifyTokenFile -PathType Leaf)
    }
}
'@ `
    -New @'
    $TokenStored = if ($Repository.Provider -eq "Turso") {
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
'@ `
    -Description "Spotify auth status Turso support"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
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
'@ `
    -New @'
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
'@ `
    -Description "Spotify OAuth state write"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
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
'@ `
    -New @'
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
'@ `
    -Description "Spotify OAuth state read"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
    Remove-Item `
        $SpotifyOAuthStateFile `
        -Force `
        -ErrorAction SilentlyContinue
}
function Start-SpotifyAuthorization {
'@ `
    -New @'
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
'@ `
    -Description "Spotify OAuth state cleanup"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
            $env:SPOTIFY_CLIENT_ID,
            $SessionToken,
'@ `
    -New @'
            $env:SPOTIFY_CLIENT_ID,
            $env:TURSO_AUTH_TOKEN,
            $SessionToken,
'@ `
    -Description "Turso token log redaction"

$RenderYaml = @'
services:
  - type: web
    name: driveos
    runtime: docker
    plan: free
    region: ohio
    branch: web-hosting-prep
    autoDeployTrigger: commit
    healthCheckPath: /healthz
    envVars:
      - key: DRIVEOS_MODE
        value: web
      - key: DRIVEOS_DATA_DIR
        value: /tmp/driveos
      - key: DRIVEOS_REPOSITORY_PROVIDER
        value: Turso
      - key: DRIVEOS_SESSION_HOURS
        value: "24"
      - key: TURSO_DATABASE_URL
        value: libsql://driveos-drumpat01.aws-us-east-2.turso.io
      - key: TURSO_AUTH_TOKEN
        sync: false
      - key: DRIVEOS_OWNER_EMAIL
        sync: false
      - key: DRIVEOS_PASSWORD_HASH
        sync: false
      - key: DRIVEOS_AUTH_SECRET
        sync: false
      - key: DRIVEOS_ENCRYPTION_KEY
        sync: false
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

$Dockerfile = @'
FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

ENV DRIVEOS_MODE=web
ENV DRIVEOS_DATA_DIR=/tmp/driveos
ENV DRIVEOS_REPOSITORY_PROVIDER=Turso

EXPOSE 10000

CMD ["pwsh", "-NoLogo", "-NoProfile", "-File", "./DriveOS-Server.ps1"]
'@

$WebEnv = $WebEnv.Replace(
    "DRIVEOS_DATA_DIR=/app/data`nDRIVEOS_REPOSITORY_PROVIDER=SQLite",
    "DRIVEOS_DATA_DIR=/tmp/driveos`nDRIVEOS_REPOSITORY_PROVIDER=Turso`nTURSO_DATABASE_URL=`nTURSO_AUTH_TOKEN="
)

$TursoTests = @'
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$TursoModulePath = Join-Path $Root "src\Storage\DriveOS.Turso.psm1"
$RepositoryModulePath = Join-Path $Root "src\Repositories\DriveOS.Repository.psm1"

function Assert-True {
    param([bool]$Condition,[string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

Import-Module $TursoModulePath -Force
Import-Module $RepositoryModulePath -Force

$HttpUrl = Get-DriveOSTursoHttpUrl `
    -DatabaseUrl "libsql://driveos-example.turso.io"

Assert-True `
    ($HttpUrl -eq "https://driveos-example.turso.io") `
    "Turso libsql URL should convert to HTTPS."

$BadUrlRejected = $false

try {
    $null = Get-DriveOSTursoHttpUrl -DatabaseUrl "https://evil.example.com"
}
catch {
    $BadUrlRejected = $true
}

Assert-True $BadUrlRejected "Unexpected Turso URL formats must be rejected."

$OldProvider = $env:DRIVEOS_REPOSITORY_PROVIDER
$OldUrl = $env:TURSO_DATABASE_URL
$OldToken = $env:TURSO_AUTH_TOKEN

try {
    $env:DRIVEOS_REPOSITORY_PROVIDER = "Turso"
    $env:TURSO_DATABASE_URL = "libsql://driveos-example.turso.io"
    $env:TURSO_AUTH_TOKEN = "test-token"

    $Repository = New-DriveOSRepository `
        -DataDirectory (Join-Path $env:TEMP "driveos-turso-test")

    Assert-True ($Repository.Provider -eq "Turso") "Repository provider should support Turso."
    Assert-True ($Repository.TursoDatabaseUrl -eq $env:TURSO_DATABASE_URL) "Turso database URL should be retained."
    Assert-True ($Repository.TursoAuthToken -eq "test-token") "Turso auth token should load from environment."
}
finally {
    $env:DRIVEOS_REPOSITORY_PROVIDER = $OldProvider
    $env:TURSO_DATABASE_URL = $OldUrl
    $env:TURSO_AUTH_TOKEN = $OldToken
}

$Source = Get-Content $TursoModulePath -Raw

Assert-True ($Source -match '/v2/pipeline') "Turso storage must use SQL-over-HTTP."
Assert-True ($Source -match 'Authorization\s*=\s*"Bearer') "Turso requests must use Bearer auth."
Assert-True ($Source -match 'CREATE TABLE IF NOT EXISTS app_state') "Turso must persist app state."

Write-Host "DriveOS Turso checks passed." -ForegroundColor Green
'@

$DeploymentTests = @'
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition,[string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

$Server = Get-Content (Join-Path $Root "DriveOS-Server.ps1") -Raw
$Repository = Get-Content (Join-Path $Root "src\Repositories\DriveOS.Repository.psm1") -Raw
$Render = Get-Content (Join-Path $Root "render.yaml") -Raw
$Docker = Get-Content (Join-Path $Root "Dockerfile") -Raw

Assert-True (Test-Path (Join-Path $Root "src\Storage\DriveOS.Turso.psm1")) "Turso storage module is missing."
Assert-True ($Repository -match "Turso") "Repository abstraction must support Turso."
Assert-True ($Server -match "Initialize-DriveOSTurso") "Server must initialize Turso."
Assert-True ($Server -match '"spotify-token"') "Spotify tokens must use persistent hosted state."
Assert-True ($Server -match '"spotify-oauth-state"') "Spotify OAuth state must use persistent hosted state."
Assert-True ($Render -match 'plan:\s*free') "Render service must use Free."
Assert-True ($Render -match 'region:\s*ohio') "Render service should use Ohio."
Assert-True (-not ($Render -match '(?m)^\s*disk:')) "Free Render service must not attach a disk."
Assert-True ($Render -match 'DRIVEOS_REPOSITORY_PROVIDER[\s\S]{0,60}value:\s*Turso') "Render must use Turso."
Assert-True ($Render -match 'TURSO_AUTH_TOKEN[\s\S]{0,60}sync:\s*false') "Turso token must stay private."
Assert-True ($Render -match 'libsql://driveos-drumpat01\.aws-us-east-2\.turso\.io') "Expected Turso URL is missing."
Assert-True ($Docker -match 'DRIVEOS_REPOSITORY_PROVIDER=Turso') "Docker must default to Turso."
Assert-True (-not ($Docker -match 'sqlite3')) "Free container should not install SQLite."

Write-Host "DriveOS free web deployment checks passed." -ForegroundColor Green
'@

foreach ($Required in @(
    "DriveOS.Turso.psm1",
    "Initialize-DriveOSTurso",
    '"spotify-token"',
    '"spotify-oauth-state"',
    "TURSO_AUTH_TOKEN"
)) {
    if (-not $Server.Contains($Required)) {
        throw "Patch validation failed; server missing $Required"
    }
}

Write-Utf8NoBom -Path $TursoPath -Content $TursoModule
Write-Utf8NoBom -Path $RepositoryPath -Content $RepositoryModule
Write-Utf8NoBom -Path $ServerPath -Content $Server
Write-Utf8NoBom -Path $RenderPath -Content $RenderYaml
Write-Utf8NoBom -Path $DockerfilePath -Content $Dockerfile
Write-Utf8NoBom -Path $WebEnvPath -Content $WebEnv
Write-Utf8NoBom -Path $TursoTestsPath -Content $TursoTests
Write-Utf8NoBom -Path $DeploymentTestsPath -Content $DeploymentTests

Write-Host ""
Write-Host "DriveOS free Render + Turso batch applied." -ForegroundColor Green
Write-Host ""
Write-Host "Run:"
Write-Host "  .\tests\WebHostingPrep.Tests.ps1"
Write-Host "  .\tests\WebAuth.Tests.ps1"
Write-Host "  .\tests\WebSession.Tests.ps1"
Write-Host "  .\tests\WebRequest.Tests.ps1"
Write-Host "  .\tests\SecretProtection.Tests.ps1"
Write-Host "  .\tests\Turso.Tests.ps1"
Write-Host "  .\tests\WebDeployment.Tests.ps1"
