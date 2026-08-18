param([string]$TargetDatabase = $env:DRIVEOS_NODE_DATABASE)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($TargetDatabase) -or -not (Test-Path -LiteralPath $TargetDatabase -PathType Leaf)) { throw 'The initialized Atlas database is required.' }
$DataRoot = [IO.Path]::GetFullPath("$($env:DRIVEOS_NODE_DATA_ROOT)")
$Target = [IO.Path]::GetFullPath($TargetDatabase)
if (-not $DataRoot -or -not $Target.StartsWith($DataRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::Ordinal)) { throw 'The Atlas database must remain inside DRIVEOS_NODE_DATA_ROOT.' }
if (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN) { throw 'Turso credentials are required to refresh Atlas.' }

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
$Repository = [pscustomobject]@{ TursoDatabaseUrl = $env:TURSO_DATABASE_URL; TursoAuthToken = $env:TURSO_AUTH_TOKEN }
$Household = if ($env:DRIVEOS_NODE_HOUSEHOLD_ID) { $env:DRIVEOS_NODE_HOUSEHOLD_ID } else { 'household_primary' }
$PrivateSnapshot = Join-Path $DataRoot ("private-sync-{0}.json" -f [guid]::NewGuid().ToString('N'))
try {
    $Before = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @($Household))[0].count)
    $Snapshot = [ordered]@{
        households = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,display_name,created_at_utc,updated_at_utc FROM households WHERE id=?;' -Args @($Household))
        vehicles = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc FROM vehicles WHERE household_id=?;' -Args @($Household))
        drives = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc FROM drives WHERE household_id=? ORDER BY started_at_epoch,id;' -Args @($Household))
        appState = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT key,value_json,updated_at FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences') ORDER BY key;")
    }
    $After = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @($Household))[0].count)
    if ($Before -ne $After -or $Snapshot.drives.Count -ne $After) { throw 'Turso changed during Atlas refresh; the existing snapshot remains active.' }
    [IO.File]::WriteAllText($PrivateSnapshot, ($Snapshot | ConvertTo-Json -Depth 20 -Compress), [Text.UTF8Encoding]::new($false))
    & node --import tsx (Join-Path $Root 'server\tools\sync-hosted-snapshot.ts') $PrivateSnapshot
    if ($LASTEXITCODE -ne 0) { throw 'Atlas source refresh failed.' }
}
finally {
    Remove-Item -LiteralPath $PrivateSnapshot -Force -ErrorAction SilentlyContinue
    $Repository = $null
}
