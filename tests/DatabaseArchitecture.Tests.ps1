$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Migrations.psm1') -Force

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }
function Assert-Equal { param($Actual,$Expected,[string]$Message) if ($Actual -ne $Expected) { throw "$Message Expected '$Expected', got '$Actual'." } }

$Migrations = @(Get-DriveOSOrderedMigrations)
Assert-Equal $Migrations.Count 8 'Ordered migration count changed.'
Assert-Equal $Migrations[0].Version 1 'Baseline migration must remain first.'
Assert-Equal $Migrations[1].Version 2 'Durable Tessie migration must remain second.'
Assert-Equal $Migrations[2].Version 3 'Durable integrity audit migration must remain third.'
Assert-Equal $Migrations[3].Version 4 'Journey Collections migration must remain fourth.'
Assert-Equal $Migrations[4].Version 5 'Journey attachment migration must remain fifth.'
Assert-Equal $Migrations[5].Version 6 'Atlas read-model migration must remain sixth.'
Assert-Equal $Migrations[6].Version 7 'Memories migration must remain seventh.'
Assert-Equal $Migrations[7].Version 8 'JourneyDeck Recorder migration must remain eighth.'
$SchemaSql = @($Migrations | ForEach-Object { Get-Content -LiteralPath $_.Path -Raw }) -join "`n"
Assert-True (-not ($SchemaSql -match '(?im)^\s*PRAGMA\s+optimize\s*;')) 'Shared migrations must not send transaction-unsafe PRAGMA optimize to Turso.'
foreach ($Table in @('schema_migrations','households','app_users','household_members','user_preferences','vehicles','drives','charging_sessions','integration_sync_cursors','integration_sync_runs','durable_rollups','integrity_audit_runs','journey_collections','journey_collection_drives','journey_attachments','memories','memory_collections','memory_attachments','memory_suggestions','atlas_snapshots','atlas_place_details','atlas_pattern_candidates','atlas_pattern_reviews','atlas_place_labels','atlas_snapshot_state','recorder_sessions','recorder_points')) {
    if ($Table -eq 'schema_migrations') { continue }
    Assert-True ($SchemaSql -match "CREATE TABLE IF NOT EXISTS $Table") "Shared schema is missing $Table."
}

$Now = [DateTimeOffset]::UtcNow
$Started = $Now.AddHours(-2).ToUnixTimeSeconds()
$Ended = $Now.AddHours(-1).ToUnixTimeSeconds()
$Vehicle = [PSCustomObject]@{ vin='TESTVIN00000000001'; last_state=[PSCustomObject]@{ display_name='Test Vehicle' } }
$Drive = [PSCustomObject]@{
    id='tessie-drive-1'
    started_at=$Started; ended_at=$Ended; starting_location='Home raw'; ending_location='Work raw'
    starting_latitude=32.1; starting_longitude=-97.1; ending_latitude=32.2; ending_longitude=-97.2
    starting_battery=80; ending_battery=70; odometer_distance=10.5; energy_used=2.5
    average_speed=31; max_speed=62; tag='Commute'; driver_profile='Owner'
}
$Charge = [PSCustomObject]@{
    id='tessie-charge-1'; started_at=$Started; ended_at=$Ended; location='Home raw'; latitude=32.1; longitude=-97.1
    is_supercharger=$false; odometer=1000; energy_added=20.25; energy_used=21; miles_added=80
    starting_battery=20; ending_battery=80; cost=$null
}
$SnapshotOne = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -SyncedAtUtc $Now
$SnapshotTwo = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -SyncedAtUtc $Now
Assert-Equal $SnapshotOne.vehicle.id $SnapshotTwo.vehicle.id 'Vehicle internal ID is not stable.'
Assert-Equal $SnapshotOne.drives[0].id $SnapshotTwo.drives[0].id 'Drive internal ID is not stable.'
Assert-Equal $SnapshotOne.charges[0].id $SnapshotTwo.charges[0].id 'Charging-session internal ID is not stable.'
Assert-Equal $SnapshotOne.drives[0].providerDriveId 'tessie-drive-1' 'Tessie drive provider identity was not retained.'
Assert-Equal $SnapshotOne.drives[0].legacyDriveId "$Started-$Ended" 'Legacy drive ID compatibility changed.'
Assert-Equal (($SnapshotOne.drives[0].rawPayloadJson | ConvertFrom-Json).starting_location) 'Home raw' 'Raw drive payload did not round-trip.'
$Drive.ended_at = $Ended + 60
$CorrectedSnapshot = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives @($Drive) -RangeToUtc $Now -SyncedAtUtc $Now
Assert-Equal $CorrectedSnapshot.drives[0].id $SnapshotOne.drives[0].id 'A corrected Tessie timeframe changed the stable internal drive ID.'
$Drive.ended_at = $Ended

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
Assert-True ($Server -match 'JOURNEYDECK_TESSIE_DB_WRITE_ENABLED') 'Durable Tessie write rollout flag is missing.'
Assert-True ($Server -match 'JOURNEYDECK_TESSIE_DB_READ_ENABLED') 'Durable Tessie read rollout flag is missing.'
Assert-True ($Server -match 'JOURNEYDECK_TESSIE_READ_CANARY_APPROVED') 'Durable Tessie read canary approval guard is missing.'
Assert-True ($Server -match 'DB_READ_ENABLED requires JOURNEYDECK_TESSIE_READ_CANARY_APPROVED=true') 'Database reads are not guarded by explicit parity approval.'
Assert-True (-not ($Server -match '/api/tessie/sync')) 'Tessie ingestion must not execute through the web request process.'
Assert-True ($Server -match 'DB_READ_ENABLED requires JOURNEYDECK_TESSIE_DB_WRITE_ENABLED=true') 'Database reads are not coupled to the external worker activation flag.'
Assert-True ($Server -match 'Get-DriveOSTessieDrives -Repository') 'Database-backed historical drive path is missing.'
Assert-True ($Server -match 'Get-DriveOSTessieCharges -Repository') 'Database-backed charging path is missing.'

$SqliteExecutable = Join-Path $Root 'tools\sqlite\sqlite3.exe'
if (Test-Path -LiteralPath $SqliteExecutable) {
    $Scratch = Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-database-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $Scratch | Out-Null
    try {
        $Repository = New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider SQLite
        Initialize-DriveOSSqlite -Repository $Repository
        Initialize-DriveOSSqlite -Repository $Repository
        $Versions = @(Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT version FROM schema_migrations ORDER BY version;' -Json)
        Assert-Equal $Versions.Count 8 'Migrations were not applied exactly once.'

        $LegacyRepository = $Repository.PSObject.Copy()
        $LegacyRepository.DatabasePath = Join-Path $Scratch 'legacy-v1.db'
        $LegacySql = @'
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
INSERT INTO schema_migrations(version,applied_at) VALUES(1,'2026-01-01T00:00:00Z');
CREATE TABLE listening_history(id TEXT PRIMARY KEY, played_at TEXT, payload_json TEXT NOT NULL);
CREATE TABLE drive_soundtracks(drive_id TEXT PRIMARY KEY, drive_started_at TEXT NOT NULL, drive_ended_at TEXT NOT NULL, status TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE place_aliases(location TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
'@
        $null = Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $LegacyRepository.DatabasePath -Sql $LegacySql
        Initialize-DriveOSSqlite -Repository $LegacyRepository
        $LegacyVersions = @(Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $LegacyRepository.DatabasePath -Sql 'SELECT version FROM schema_migrations ORDER BY version;' -Json)
        $LegacyTables = @(Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $LegacyRepository.DatabasePath -Sql "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('app_state','drives','charging_sessions') ORDER BY name;" -Json)
        Assert-Equal $LegacyVersions.Count 8 'Legacy schema version 1 did not upgrade to the current version.'
        Assert-Equal $LegacyTables.Count 3 'Legacy schema upgrade did not add all durable history tables.'

        $First = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -SyncedAtUtc $Now
        $Drive.energy_used = 2.75
        $Drive.ended_at = $Ended + 60
        $Charge.ended_at = $Ended + 120
        $Second = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now.AddMinutes(1) -SyncedAtUtc $Now.AddMinutes(1)
        Assert-Equal $First.drives 1 'First Tessie snapshot drive count changed.'
        Assert-Equal $Second.charges 1 'Retry Tessie snapshot charge count changed.'

        $StoredDrives = @(Get-DriveOSTessieDrives -Repository $Repository -Days 1)
        $StoredCharges = @(Get-DriveOSTessieCharges -Repository $Repository -Days 1)
        $DriveAuditRows = @(Get-DriveOSTessieAuditRows -Repository $Repository -Resource drives -FromEpoch $Started -ToEpoch $Now.ToUnixTimeSeconds())
        $ChargeAuditRows = @(Get-DriveOSTessieAuditRows -Repository $Repository -Resource charges -FromEpoch $Started -ToEpoch $Now.ToUnixTimeSeconds())
        $ExcludedAuditRows = @(Get-DriveOSTessieAuditRows -Repository $Repository -Resource drives -FromEpoch ($Ended + 1) -ToEpoch $Now.ToUnixTimeSeconds())
        Assert-Equal $StoredDrives.Count 1 'Idempotent drive upsert created a duplicate.'
        Assert-Equal $StoredCharges.Count 1 'Idempotent charging upsert created a duplicate.'
        Assert-Equal $DriveAuditRows.Count 1 'Bounded drive parity query omitted an in-range row.'
        Assert-Equal $ChargeAuditRows.Count 1 'Bounded charging parity query omitted an in-range row.'
        Assert-Equal $ExcludedAuditRows.Count 0 'Bounded parity query included a row before its lower boundary.'
        Assert-Equal $DriveAuditRows[0].energy_used_kwh 2.75 'Drive parity query did not expose normalized columns.'
        Assert-Equal $DriveAuditRows[0].ended_at_epoch ($Ended + 60) 'Corrected drive epoch was not updated in normalized storage.'
        Assert-Equal $DriveAuditRows[0].legacy_drive_id "$Started-$($Ended + 60)" 'Corrected legacy drive ID was not updated.'
        Assert-Equal $ChargeAuditRows[0].ended_at_epoch ($Ended + 120) 'Corrected charging epoch was not updated in normalized storage.'
        Assert-Equal $StoredDrives[0].energy_used 2.75 'Retry did not update the durable drive payload.'
        Assert-Equal $StoredDrives[0].ended_at ($Ended + 60) 'Corrected drive payload was not retained.'
        Assert-Equal $StoredCharges[0].ended_at ($Ended + 120) 'Corrected charging payload was not retained.'
        Assert-Equal $StoredCharges[0].id 'tessie-charge-1' 'Charging payload compatibility changed.'

        $Cursor = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource drives
        Assert-Equal $Cursor.cursor_value $Now.AddMinutes(1).ToUnixTimeSeconds() 'Sync cursor did not advance transactionally.'

        $ChargeCursorBefore = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource charges
        $DriveRun = New-DriveOSIntegrationSyncRun -Provider tessie -Resource drives -RangeFromUtc $Now -RangeToUtc $Now.AddMinutes(2) -StartedAtUtc $Now
        $DriveRun.status = 'succeeded'
        $DriveRun.recordsSeen = 1
        $DriveRun.recordsWritten = 1
        $DriveRun.completedAtUtc = $Now.AddMinutes(2).ToString('o')
        $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -RangeToUtc $Now.AddMinutes(2) -SyncedAtUtc $Now.AddMinutes(2) -CompletedResources @('drives') -SyncRun $DriveRun
        $DriveCursorAfter = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource drives
        $ChargeCursorAfter = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource charges
        Assert-Equal $DriveCursorAfter.cursor_value $Now.AddMinutes(2).ToUnixTimeSeconds() 'Independent drive cursor did not advance.'
        Assert-Equal $ChargeCursorAfter.cursor_value $ChargeCursorBefore.cursor_value 'Drive completion incorrectly advanced the charging cursor.'

        $FailedRun = New-DriveOSIntegrationSyncRun -Provider tessie -Resource drives -RangeFromUtc $Now.AddMinutes(2) -RangeToUtc $Now.AddMinutes(3) -StartedAtUtc $Now.AddMinutes(2)
        $FailedRun.status = 'failed'
        $FailedRun.completedAtUtc = $Now.AddMinutes(3).ToString('o')
        $FailedRun.errorMessage = 'provider timeout'
        Set-DriveOSIntegrationSyncRun -Repository $Repository -Run $FailedRun
        $CursorAfterFailure = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource drives
        $FailedRows = @(Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT status,error_message FROM integration_sync_runs WHERE id='$($FailedRun.id)';" -Json)
        Assert-Equal $CursorAfterFailure.cursor_value $DriveCursorAfter.cursor_value 'Failed sync attempt incorrectly advanced the drive cursor.'
        Assert-Equal $CursorAfterFailure.last_error 'provider timeout' 'Failed sync error was not persisted on the resource cursor.'
        Assert-Equal $FailedRows[0].status 'failed' 'Failed sync run status was not persisted.'

        $AuditRun = [pscustomobject]@{
            id='audit-test-1'; householdId='household_primary'; auditKind='tessie-parity'; status='ready'; readyForReadCanary=$true
            rangeFromUtc=$Now.AddDays(-30).ToString('o'); rangeToUtc=$Now.ToString('o'); generatedAtUtc=$Now.ToString('o'); completedAtUtc=$Now.AddMinutes(1).ToString('o')
            report=[pscustomobject]@{ status='ready'; resources=[pscustomobject]@{ drives=[pscustomobject]@{ passed=$true }; charges=[pscustomobject]@{ passed=$true } } }
        }
        Set-DriveOSIntegrityAuditRun -Repository $Repository -Run $AuditRun
        Set-DriveOSIntegrityAuditRun -Repository $Repository -Run $AuditRun
        $LatestAudit = Get-DriveOSLatestIntegrityAuditRun -Repository $Repository
        $AuditRows = @(Invoke-DriveOSSqlite -Executable $SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT id FROM integrity_audit_runs WHERE id='audit-test-1';" -Json)
        Assert-Equal $AuditRows.Count 1 'Integrity audit retry created a duplicate result.'
        Assert-Equal $LatestAudit.status 'ready' 'Latest integrity audit status did not round-trip.'
        Assert-True $LatestAudit.readyForReadCanary 'Latest integrity audit readiness did not round-trip.'
        Assert-True $LatestAudit.report.resources.drives.passed 'Integrity audit privacy-safe report did not round-trip.'
        Assert-True (Test-DriveOSSqliteIntegrity -Repository $Repository) 'SQLite integrity check failed after Tessie upserts.'

        $CollectionNow = [DateTimeOffset]::UtcNow.ToString('o')
        $Collection = [pscustomobject]@{ id='collection_11111111111111111111111111111111'; name='Road trips'; description='Test collection'; driveIds=@("$Started-$($Ended + 60)"); createdAtUtc=$CollectionNow; updatedAtUtc=$CollectionNow }
        Set-DriveOSJourneyCollection -Repository $Repository -Collection $Collection
        $SavedCollections = @(Get-DriveOSJourneyCollections -Repository $Repository)
        Assert-Equal $SavedCollections.Count 1 'Journey collection did not round-trip.'
        Assert-Equal $SavedCollections[0].driveIds[0] "$Started-$($Ended + 60)" 'Collection membership lost the existing legacy drive ID.'
        $Drive.ended_at = $Ended + 180
        $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -RangeToUtc $Now.AddMinutes(4) -SyncedAtUtc $Now.AddMinutes(4) -CompletedResources @('drives')
        $CorrectedCollections = @(Get-DriveOSJourneyCollections -Repository $Repository)
        Assert-Equal $CorrectedCollections[0].driveIds[0] "$Started-$($Ended + 180)" 'Collection did not follow the stable internal drive ID after provider correction.'
        Remove-DriveOSJourneyCollection -Repository $Repository -CollectionId $Collection.id
        Assert-Equal @(Get-DriveOSJourneyCollections -Repository $Repository).Count 0 'Collection deletion did not remove the collection.'
        Assert-Equal @(Get-DriveOSTessieDrives -Repository $Repository -Days 1).Count 1 'Collection deletion removed durable drive history.'
    }
    finally {
        if (Test-Path -LiteralPath $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
    }
}
else { Write-Warning 'SQLite runtime unavailable; migration execution and durable upsert tests skipped.' }

Write-Host 'JourneyDeck database architecture checks passed.' -ForegroundColor Green
