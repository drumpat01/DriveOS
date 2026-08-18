param(
    [string]$TargetDatabase = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data\atlas-node-dev\journeydeck-local.db')
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AllowedRoot = [IO.Path]::GetFullPath((Join-Path $Root 'data\atlas-node-dev'))
$ResolvedTarget = [IO.Path]::GetFullPath($TargetDatabase)
if (-not $ResolvedTarget.StartsWith($AllowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'The development database must remain inside data\atlas-node-dev.' }
if (Test-Path -LiteralPath $ResolvedTarget) { throw "Refusing to overwrite the existing development database: $ResolvedTarget" }

Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
$SecretPath = Join-Path $Root 'data\driveos-secrets.json'
if (-not (Test-Path -LiteralPath $SecretPath)) { throw 'The encrypted desktop secret store is unavailable.' }
$Secrets = Get-Content -LiteralPath $SecretPath -Raw | ConvertFrom-Json
$DatabaseUrl = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop
$AuthToken = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop
$Repository = [pscustomobject]@{ TursoDatabaseUrl = $DatabaseUrl; TursoAuthToken = $AuthToken }

$PrivateSnapshot = Join-Path $AllowedRoot ("private-import-{0}.json" -f [guid]::NewGuid().ToString('N'))
try {
    $CountBefore = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @('household_primary'))[0].count)
    $Snapshot = [ordered]@{
        households = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,display_name,created_at_utc,updated_at_utc FROM households WHERE id=?;' -Args @('household_primary'))
        vehicles = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc FROM vehicles WHERE household_id=?;' -Args @('household_primary'))
        drives = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc FROM drives WHERE household_id=? ORDER BY started_at_epoch,id;' -Args @('household_primary'))
        appState = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT key,value_json,updated_at FROM app_state WHERE key IN ('foursquare-cache','mobility-preferences') ORDER BY key;")
    }
    $CountAfter = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT COUNT(*) AS count FROM drives WHERE household_id=?;' -Args @('household_primary'))[0].count)
    if ($CountBefore -ne $CountAfter -or $Snapshot.drives.Count -ne $CountAfter) { throw 'The source changed while the read-only development snapshot was created; retry.' }
    [IO.Directory]::CreateDirectory($AllowedRoot) | Out-Null
    [IO.File]::WriteAllText($PrivateSnapshot, ($Snapshot | ConvertTo-Json -Depth 20 -Compress), [Text.UTF8Encoding]::new($false))
    $env:DRIVEOS_NODE_DATABASE = $ResolvedTarget
    & node --import tsx (Join-Path $Root 'server\tools\import-development-snapshot.ts') $PrivateSnapshot
    if ($LASTEXITCODE -ne 0) { throw 'The private development snapshot import failed.' }
}
finally {
    Remove-Item Env:\DRIVEOS_NODE_DATABASE -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $PrivateSnapshot) { Remove-Item -LiteralPath $PrivateSnapshot -Force }
    $DatabaseUrl = $null; $AuthToken = $null; $Repository = $null
}
