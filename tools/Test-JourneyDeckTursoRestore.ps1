param(
    [Parameter(Mandatory=$true)][string]$Organization,
    [Parameter(Mandatory=$true)][string]$SourceDatabase,
    [string]$Group = 'default',
    [string]$PlatformToken = $env:TURSO_PLATFORM_TOKEN,
    [string]$SourceDatabaseUrl = $env:TURSO_DATABASE_URL,
    [string]$SourceAuthToken = $env:TURSO_AUTH_TOKEN,
    [switch]$ConfirmProductionReadOnly
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmProductionReadOnly) { throw 'ConfirmProductionReadOnly is required; the source database is read-only and only a disposable copy may be changed.' }
foreach ($Required in @('Organization','SourceDatabase','Group','PlatformToken','SourceDatabaseUrl','SourceAuthToken')) {
    if ([string]::IsNullOrWhiteSpace("$(Get-Variable -Name $Required -ValueOnly)")) { throw "$Required is required." }
}
if ($Organization -notmatch '^[a-z0-9-]+$' -or $SourceDatabase -notmatch '^[a-z0-9-]+$' -or $Group -notmatch '^[a-z0-9-]+$') { throw 'Turso organization, database, and group names must use lowercase letters, numbers, and dashes.' }

$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force

$ApiBase = "https://api.turso.tech/v1/organizations/$Organization/databases"
$Headers = @{ Authorization="Bearer $PlatformToken" }
$DisposableName = "journeydeck-restore-$([DateTimeOffset]::UtcNow.ToString('yyyyMMdd-HHmmss'))-$(([guid]::NewGuid().ToString('N')).Substring(0,6))"
$Created = $false
$Deleted = $false
$CountTables = @('schema_migrations','drives','charging_sessions','listening_history','drive_soundtracks','app_state','integration_sync_cursors','integrity_audit_runs')

function Invoke-TursoPlatform {
    param([string]$Method,[string]$Uri,$Body)
    $Arguments = @{ Method=$Method; Uri=$Uri; Headers=$Headers; TimeoutSec=30 }
    if ($null -ne $Body) { $Arguments.ContentType='application/json'; $Arguments.Body=($Body | ConvertTo-Json -Depth 8 -Compress) }
    return Invoke-RestMethod @Arguments
}

function Get-TableCounts {
    param($Repository)
    $Counts = [ordered]@{}
    foreach ($Table in $CountTables) {
        $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT COUNT(*) AS row_count FROM $Table;")
        if ($Rows.Count -ne 1) { throw "Count verification failed for $Table." }
        $Counts[$Table] = [long]$Rows[0].row_count
    }
    return $Counts
}

try {
    $SourceRepository = [pscustomobject]@{ TursoDatabaseUrl=$SourceDatabaseUrl; TursoAuthToken=$SourceAuthToken }
    $SourceCountsBefore = Get-TableCounts -Repository $SourceRepository
    $Create = Invoke-TursoPlatform -Method Post -Uri $ApiBase -Body ([ordered]@{ name=$DisposableName; group=$Group; seed=[ordered]@{ type='database'; name=$SourceDatabase } })
    $Created = $true
    if (-not $Create.database.Hostname) { throw 'Turso did not return a hostname for the disposable restore.' }
    $TokenResponse = Invoke-TursoPlatform -Method Post -Uri "$ApiBase/$DisposableName/auth/tokens?expiration=1d&authorization=full-access" -Body $null
    if (-not $TokenResponse.jwt) { throw 'Turso did not issue a scoped token for the disposable restore.' }

    $RestoreRepository = [pscustomobject]@{ TursoDatabaseUrl="libsql://$($Create.database.Hostname)"; TursoAuthToken="$($TokenResponse.jwt)" }
    $Ready = $false
    for ($Attempt=1; $Attempt -le 12; $Attempt++) {
        try { $null = Invoke-DriveOSTursoQuery -Repository $RestoreRepository -Sql 'SELECT 1 AS ready;'; $Ready=$true; break }
        catch { if ($Attempt -eq 12) { throw }; Start-Sleep -Seconds 5 }
    }
    if (-not $Ready) { throw 'Disposable restore did not become queryable within one minute.' }

    $SourceCounts = Get-TableCounts -Repository $SourceRepository
    $RestoreCounts = Get-TableCounts -Repository $RestoreRepository
    foreach ($Table in $CountTables) {
        if ($SourceCountsBefore[$Table] -ne $SourceCounts[$Table]) { throw "Source row counts changed while the restore snapshot was created; retry outside an ingestion window." }
        if ($SourceCounts[$Table] -ne $RestoreCounts[$Table]) { throw "Restored row count differs for $Table." }
    }
    $Integrity = @(Invoke-DriveOSTursoQuery -Repository $RestoreRepository -Sql 'PRAGMA integrity_check;')
    if ($Integrity.Count -ne 1 -or "$($Integrity[0].integrity_check)" -ne 'ok') { throw 'Disposable restore failed SQLite integrity_check.' }
    $Versions = @(Invoke-DriveOSTursoQuery -Repository $RestoreRepository -Sql 'SELECT version FROM schema_migrations ORDER BY version;')
    $ExpectedVersions = @(1..(Get-ChildItem (Join-Path $Root 'src\Storage\Migrations') -Filter '*.sql' -File).Count)
    if (($Versions.version -join ',') -ne ($ExpectedVersions -join ',')) { throw 'Disposable restore does not contain the expected ordered migration set.' }

    [pscustomobject]@{ ok=$true; sourceReadOnly=$true; disposableDatabase=$DisposableName; migrationVersions=@($Versions.version); verifiedTables=@($CountTables); rowCountParity=$true; integrityCheck='ok' }
}
finally {
    if ($Created) {
        try { $null = Invoke-TursoPlatform -Method Delete -Uri "$ApiBase/$DisposableName" -Body $null } finally {
            try { $null = Invoke-TursoPlatform -Method Get -Uri "$ApiBase/$DisposableName" -Body $null; throw 'Disposable restore still exists after deletion.' }
            catch {
                $StatusCode = $_.Exception.Response.StatusCode.value__
                if ($StatusCode -eq 404) { $Deleted=$true } elseif ($_.Exception.Message -eq 'Disposable restore still exists after deletion.') { throw } else { throw }
            }
        }
    }
    if ($Created -and -not $Deleted) { throw 'Disposable restore cleanup could not be independently confirmed.' }
}
