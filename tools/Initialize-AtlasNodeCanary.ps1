param([string]$TargetDatabase = $env:DRIVEOS_NODE_DATABASE)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($TargetDatabase)) { throw 'DRIVEOS_NODE_DATABASE is required.' }
$DataRoot = [IO.Path]::GetFullPath("$($env:DRIVEOS_NODE_DATA_ROOT)")
$Target = [IO.Path]::GetFullPath($TargetDatabase)
if (-not $DataRoot -or -not $Target.StartsWith($DataRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)) { throw 'The canary database must remain inside DRIVEOS_NODE_DATA_ROOT.' }
if (Test-Path -LiteralPath $Target -PathType Leaf) { Write-Host "Using existing Atlas canary database: $Target"; return }
if (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN) { throw 'Turso credentials are required to initialize the Atlas canary.' }

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
$Repository = [pscustomobject]@{ TursoDatabaseUrl = $env:TURSO_DATABASE_URL; TursoAuthToken = $env:TURSO_AUTH_TOKEN }
$Household = if ($env:DRIVEOS_NODE_HOUSEHOLD_ID) { $env:DRIVEOS_NODE_HOUSEHOLD_ID } else { 'household_primary' }
[IO.Directory]::CreateDirectory($DataRoot) | Out-Null
$PrivateSnapshot = Join-Path $DataRoot ("private-import-{0}.json" -f [guid]::NewGuid().ToString('N'))
$StagingDatabase = "$Target.staging"
try {
    Remove-Item -LiteralPath $StagingDatabase -Force -ErrorAction SilentlyContinue
    $Before = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @($Household))[0].count)
    $Snapshot = [ordered]@{
        households = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,display_name,created_at_utc,updated_at_utc FROM households WHERE id=?;' -Args @($Household))
        vehicles = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc FROM vehicles WHERE household_id=?;' -Args @($Household))
        drives = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc FROM drives WHERE household_id=? ORDER BY started_at_epoch,id;' -Args @($Household))
        appState = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT key,value_json,updated_at FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences') ORDER BY key;")
    }
    $After = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @($Household))[0].count)
    if ($Before -ne $After -or $Snapshot.drives.Count -ne $After) { throw 'Turso changed during the canary snapshot; restart to retry safely.' }
    [IO.File]::WriteAllText($PrivateSnapshot, ($Snapshot | ConvertTo-Json -Depth 20 -Compress), [Text.UTF8Encoding]::new($false))
    $OriginalDatabase = $env:DRIVEOS_NODE_DATABASE
    $env:DRIVEOS_NODE_DATABASE = $StagingDatabase
    & node --import tsx (Join-Path $Root 'server\tools\import-development-snapshot.ts') $PrivateSnapshot
    if ($LASTEXITCODE -ne 0) { throw 'Atlas canary import failed.' }
    Move-Item -LiteralPath $StagingDatabase -Destination $Target
    $env:DRIVEOS_NODE_DATABASE = $OriginalDatabase
}
finally {
    if ($OriginalDatabase) { $env:DRIVEOS_NODE_DATABASE = $OriginalDatabase }
    Remove-Item -LiteralPath $PrivateSnapshot -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $StagingDatabase -Force -ErrorAction SilentlyContinue
    $Repository = $null
}
