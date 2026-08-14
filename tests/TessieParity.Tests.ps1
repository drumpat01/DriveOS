$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Drives\DriveOS.Drives.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Charging\DriveOS.Charging.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieParity.psm1') -Force

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }
function Assert-Equal { param($Actual,$Expected,[string]$Message) if ($Actual -ne $Expected) { throw "$Message Expected '$Expected', got '$Actual'." } }

$Now = [DateTimeOffset]::Parse('2026-08-14T14:00:00Z')
$Started = $Now.AddHours(-2).ToUnixTimeSeconds()
$Ended = $Now.AddHours(-1).ToUnixTimeSeconds()
$Vin = 'TESTVIN00000000001'
$Vehicle = [PSCustomObject]@{ vin=$Vin; last_state=[PSCustomObject]@{ display_name='Test Vehicle' } }
$Drive = [PSCustomObject]@{
    id=101; started_at=$Started; ended_at=$Ended; starting_location='Private start'; ending_location='Private end'
    starting_latitude=32.1; starting_longitude=-97.1; ending_latitude=32.2; ending_longitude=-97.2
    starting_battery=80; ending_battery=70; odometer_distance=10.5; energy_used=2.5
    average_speed=31; max_speed=62; tag='Commute'; driver_profile='Owner'
}
$Charge = [PSCustomObject]@{
    id='charge-private-1'; started_at=$Started; ended_at=$Ended; location='Private charger'; latitude=32.1; longitude=-97.1
    is_supercharger=$false; odometer=1000; energy_added=20.25; energy_used=21; miles_added=80
    starting_battery=20; ending_battery=80; cost=$null
}
$Snapshot = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -SyncedAtUtc $Now
$StoredDrive = $Snapshot.drives[0]
$StoredCharge = $Snapshot.charges[0]
$DriveRow = [PSCustomObject]@{
    id=$StoredDrive.id; provider_drive_id=$StoredDrive.providerDriveId; legacy_drive_id=$StoredDrive.legacyDriveId
    started_at_utc=$StoredDrive.startedAtUtc; ended_at_utc=$StoredDrive.endedAtUtc; started_at_epoch=$StoredDrive.startedAtEpoch; ended_at_epoch=$StoredDrive.endedAtEpoch
    starting_location=$StoredDrive.startingLocation; ending_location=$StoredDrive.endingLocation
    starting_latitude=$StoredDrive.startingLatitude; starting_longitude=$StoredDrive.startingLongitude; ending_latitude=$StoredDrive.endingLatitude; ending_longitude=$StoredDrive.endingLongitude
    starting_battery=$StoredDrive.startingBattery; ending_battery=$StoredDrive.endingBattery; distance_miles=$StoredDrive.distanceMiles; energy_used_kwh=$StoredDrive.energyUsedKwh
    average_speed_mph=$StoredDrive.averageSpeedMph; max_speed_mph=$StoredDrive.maxSpeedMph; tessie_tag=$StoredDrive.tessieTag; driver_profile=$StoredDrive.driverProfile
    raw_payload_json=$StoredDrive.rawPayloadJson
}
$ChargeRow = [PSCustomObject]@{
    id=$StoredCharge.id; provider_session_id=$StoredCharge.providerSessionId
    started_at_utc=$StoredCharge.startedAtUtc; ended_at_utc=$StoredCharge.endedAtUtc; started_at_epoch=$StoredCharge.startedAtEpoch; ended_at_epoch=$StoredCharge.endedAtEpoch
    location=$StoredCharge.location; latitude=$StoredCharge.latitude; longitude=$StoredCharge.longitude; is_supercharger=$StoredCharge.isSupercharger
    odometer_miles=$StoredCharge.odometerMiles; energy_added_kwh=$StoredCharge.energyAddedKwh; energy_used_kwh=$StoredCharge.energyUsedKwh; miles_added=$StoredCharge.milesAdded
    starting_battery=$StoredCharge.startingBattery; ending_battery=$StoredCharge.endingBattery; recorded_cost=$StoredCharge.recordedCost
    raw_payload_json=$StoredCharge.rawPayloadJson
}
$Cursor = [PSCustomObject]@{ cursor_value="$($Now.ToUnixTimeSeconds())"; last_success_at_utc=$Now.ToString('o'); last_error=$null }
$Ready = New-JourneyDeckTessieParityReport -RepositoryProvider SQLite -Vin $Vin -ProviderDrives @($Drive) -DatabaseDrives @($DriveRow) -ProviderCharges @($Charge) -DatabaseCharges @($ChargeRow) -DriveCursor $Cursor -ChargeCursor $Cursor -RangeFromUtc $Now.AddDays(-30) -RangeToUtc $Now -GeneratedAtUtc $Now.AddMinutes(5)
Assert-True $Ready.readyForReadCanary 'Matching 30-day data and fresh cursors should be ready for a read canary.'
Assert-Equal $Ready.status 'ready' 'Ready parity status changed.'
Assert-True $Ready.resources.drives.passed 'Matching drives did not pass parity.'
Assert-True $Ready.resources.charges.passed 'Matching charges did not pass parity.'

$MismatchedDriveRow = $DriveRow.PSObject.Copy()
$MismatchedDriveRow.energy_used_kwh = 99
$NotReady = New-JourneyDeckTessieParityReport -RepositoryProvider SQLite -Vin $Vin -ProviderDrives @($Drive) -DatabaseDrives @($MismatchedDriveRow) -ProviderCharges @($Charge) -DatabaseCharges @($ChargeRow) -DriveCursor $Cursor -ChargeCursor $Cursor -RangeFromUtc $Now.AddDays(-30) -RangeToUtc $Now -GeneratedAtUtc $Now.AddMinutes(5)
Assert-True (-not $NotReady.readyForReadCanary) 'A normalized drive mismatch incorrectly passed readiness.'
Assert-Equal $NotReady.status 'not_ready' 'Parity mismatch should report not_ready.'
Assert-Equal $NotReady.resources.drives.normalizedMismatchCount 1 'Normalized mismatch count changed.'
Assert-True ($NotReady.resources.drives.examples.normalizedMismatches[0].fields -contains 'energy_used_kwh') 'Mismatch report omitted the differing normalized field.'

$Incomplete = New-JourneyDeckTessieParityReport -RepositoryProvider SQLite -Vin $Vin -ProviderDrives @() -DatabaseDrives @() -ProviderCharges @() -DatabaseCharges @() -DriveCursor $Cursor -ChargeCursor $null -RangeFromUtc $Now.AddDays(-30) -RangeToUtc $Now -GeneratedAtUtc $Now.AddMinutes(5)
Assert-True (-not $Incomplete.readyForReadCanary) 'Missing charging cursor incorrectly passed readiness.'
Assert-Equal $Incomplete.status 'incomplete' 'Missing cursor should report an incomplete audit.'

$ReportJson = $Ready | ConvertTo-Json -Depth 30 -Compress
Assert-True ($ReportJson -notmatch [regex]::Escape($Vin)) 'Parity report exposed the VIN.'
Assert-True ($ReportJson -notmatch 'Private start|Private end|Private charger') 'Parity report exposed private location data.'

$Tool = Get-Content (Join-Path $Root 'tools\Test-JourneyDeckTessieParity.ps1') -Raw
Assert-True ($Tool -match 'ValidateSet\(30\)') 'Operational parity tool does not enforce the selected 30-day window.'
Assert-True ($Tool -notmatch 'Initialize-DriveOS(Sqlite|Turso)') 'Read-only parity tool must not apply migrations or mutate the database.'
Assert-True ($Tool -match 'RequireReady') 'Operational parity tool is missing its automation readiness gate.'

Write-Host 'JourneyDeck Tessie parity checks passed.' -ForegroundColor Green
