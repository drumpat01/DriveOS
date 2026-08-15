Import-Module (Join-Path $PSScriptRoot 'DriveOS.Migrations.psm1') -Force

function ConvertTo-SqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return 'NULL' }
    return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-DriveOSSqlite {
    param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Database,[Parameter(Mandatory=$true)][string]$Sql,[switch]$Json)
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { throw "SQLite runtime is missing: $Executable" }
    $arguments = @('-batch','-bail')
    if ($Json) { $arguments += '-json' }
    $arguments += $Database
    $output = ($Sql + "`n") | & $Executable @arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SQLite failed: $($output -join ' ')" }
    if ($Json) {
        $text = ($output -join "`n").Trim()
        if (-not $text) { return @() }
        $Parsed = $text | ConvertFrom-Json
        if ($null -eq $Parsed) { return @() }
        if ($Parsed -is [Array]) { return @($Parsed | ForEach-Object { $_ }) }
        return @($Parsed)
    }
    return $output
}

function Initialize-DriveOSSqlite {
    param($Repository)
    $bootstrap = @'
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
'@
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $bootstrap
    $Applied = @(
        Invoke-DriveOSSqlite `
            -Executable $Repository.SqliteExecutable `
            -Database $Repository.DatabasePath `
            -Sql 'SELECT version FROM schema_migrations ORDER BY version;' `
            -Json |
        ForEach-Object { [int]$_.version }
    )

    foreach ($Migration in @(Get-DriveOSOrderedMigrations)) {
        if ($Migration.Version -in $Applied) { continue }
        $Sql = @('PRAGMA foreign_keys=ON;','BEGIN IMMEDIATE;')
        $Sql += @($Migration.Statements)
        $Sql += "INSERT INTO schema_migrations(version,applied_at) VALUES($($Migration.Version),$(ConvertTo-SqlLiteral ([DateTimeOffset]::UtcNow.ToString('o'))));"
        $Sql += 'COMMIT;'
        $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
    }
}

function New-DriveOSSqliteSyncRunSql {
    param([Parameter(Mandatory=$true)]$Run)
    $Values = @(
        $Run.id,$Run.householdId,$Run.provider,$Run.resource,$Run.idempotencyKey,$Run.status,
        $Run.rangeFromUtc,$Run.rangeToUtc,$Run.recordsSeen,$Run.recordsWritten,$Run.startedAtUtc,
        $Run.completedAtUtc,$Run.errorMessage
    ) | ForEach-Object { ConvertTo-SqlLiteral $_ }
    return "INSERT INTO integration_sync_runs(id,household_id,provider,resource,idempotency_key,status,range_from_utc,range_to_utc,records_seen,records_written,started_at_utc,completed_at_utc,error_message) VALUES($($Values -join ',')) ON CONFLICT(id) DO UPDATE SET status=excluded.status,range_from_utc=excluded.range_from_utc,range_to_utc=excluded.range_to_utc,records_seen=excluded.records_seen,records_written=excluded.records_written,started_at_utc=excluded.started_at_utc,completed_at_utc=excluded.completed_at_utc,error_message=excluded.error_message;"
}

function Set-DriveOSSqliteTessieSnapshot {
    param($Repository,$Snapshot)

    $Now = [string]$Snapshot.syncedAtUtc
    $HouseholdId = [string]$Snapshot.householdId
    $Vehicle = $Snapshot.vehicle
    $Sql = New-Object System.Collections.Generic.List[string]
    $Sql.Add('PRAGMA foreign_keys=ON;')
    $Sql.Add('BEGIN IMMEDIATE;')
    $Sql.Add("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $HouseholdId),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add("INSERT INTO vehicles(id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Vehicle.id)),$(ConvertTo-SqlLiteral $HouseholdId),'tessie',$(ConvertTo-SqlLiteral ([string]$Vehicle.providerVehicleId)),$(ConvertTo-SqlLiteral ([string]$Vehicle.vin)),$(ConvertTo-SqlLiteral ([string]$Vehicle.displayName)),$(ConvertTo-SqlLiteral ([string]$Vehicle.observedAtUtc)),$(ConvertTo-SqlLiteral ([string]$Vehicle.rawPayloadJson)),$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET vin=excluded.vin,display_name=excluded.display_name,observed_at_utc=excluded.observed_at_utc,raw_payload_json=excluded.raw_payload_json,updated_at_utc=excluded.updated_at_utc;")

    foreach ($Drive in @($Snapshot.drives)) {
        $Values = @(
            $Drive.id,$HouseholdId,$Vehicle.id,'tessie',$Drive.providerDriveId,$Drive.legacyDriveId,$Drive.startedAtUtc,$Drive.endedAtUtc,
            $Drive.startedAtEpoch,$Drive.endedAtEpoch,$Drive.startingLocation,$Drive.endingLocation,$Drive.startingLatitude,$Drive.startingLongitude,
            $Drive.endingLatitude,$Drive.endingLongitude,$Drive.startingBattery,$Drive.endingBattery,$Drive.distanceMiles,$Drive.energyUsedKwh,
            $Drive.averageSpeedMph,$Drive.maxSpeedMph,$Drive.tessieTag,$Drive.driverProfile,$Drive.rawPayloadJson,$Drive.sourceUpdatedAtUtc,$Now,$Now
        ) | ForEach-Object { ConvertTo-SqlLiteral $_ }
        $Sql.Add("INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES($($Values -join ',')) ON CONFLICT(id) DO UPDATE SET provider_drive_id=excluded.provider_drive_id,legacy_drive_id=excluded.legacy_drive_id,started_at_utc=excluded.started_at_utc,ended_at_utc=excluded.ended_at_utc,started_at_epoch=excluded.started_at_epoch,ended_at_epoch=excluded.ended_at_epoch,starting_location=excluded.starting_location,ending_location=excluded.ending_location,starting_latitude=excluded.starting_latitude,starting_longitude=excluded.starting_longitude,ending_latitude=excluded.ending_latitude,ending_longitude=excluded.ending_longitude,starting_battery=excluded.starting_battery,ending_battery=excluded.ending_battery,distance_miles=excluded.distance_miles,energy_used_kwh=excluded.energy_used_kwh,average_speed_mph=excluded.average_speed_mph,max_speed_mph=excluded.max_speed_mph,tessie_tag=excluded.tessie_tag,driver_profile=excluded.driver_profile,raw_payload_json=excluded.raw_payload_json,source_updated_at_utc=excluded.source_updated_at_utc,updated_at_utc=excluded.updated_at_utc;")
    }

    foreach ($Charge in @($Snapshot.charges)) {
        $Values = @(
            $Charge.id,$HouseholdId,$Vehicle.id,'tessie',$Charge.providerSessionId,$Charge.startedAtUtc,$Charge.endedAtUtc,
            $Charge.startedAtEpoch,$Charge.endedAtEpoch,$Charge.location,$Charge.latitude,$Charge.longitude,$Charge.isSupercharger,
            $Charge.odometerMiles,$Charge.energyAddedKwh,$Charge.energyUsedKwh,$Charge.milesAdded,$Charge.startingBattery,$Charge.endingBattery,
            $Charge.recordedCost,$Charge.rawPayloadJson,$Charge.sourceUpdatedAtUtc,$Now,$Now
        ) | ForEach-Object { ConvertTo-SqlLiteral $_ }
        $Sql.Add("INSERT INTO charging_sessions(id,household_id,vehicle_id,provider,provider_session_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,location,latitude,longitude,is_supercharger,odometer_miles,energy_added_kwh,energy_used_kwh,miles_added,starting_battery,ending_battery,recorded_cost,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES($($Values -join ',')) ON CONFLICT(id) DO UPDATE SET provider_session_id=excluded.provider_session_id,started_at_utc=excluded.started_at_utc,ended_at_utc=excluded.ended_at_utc,started_at_epoch=excluded.started_at_epoch,ended_at_epoch=excluded.ended_at_epoch,location=excluded.location,latitude=excluded.latitude,longitude=excluded.longitude,is_supercharger=excluded.is_supercharger,odometer_miles=excluded.odometer_miles,energy_added_kwh=excluded.energy_added_kwh,energy_used_kwh=excluded.energy_used_kwh,miles_added=excluded.miles_added,starting_battery=excluded.starting_battery,ending_battery=excluded.ending_battery,recorded_cost=excluded.recorded_cost,raw_payload_json=excluded.raw_payload_json,source_updated_at_utc=excluded.source_updated_at_utc,updated_at_utc=excluded.updated_at_utc;")
    }

    foreach ($Resource in @($Snapshot.completedResources)) {
        $Sql.Add("INSERT INTO integration_sync_cursors(household_id,provider,resource,cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $HouseholdId),'tessie',$(ConvertTo-SqlLiteral $Resource),$(ConvertTo-SqlLiteral ([string]$Snapshot.cursorEpoch)),$(ConvertTo-SqlLiteral ([string]$Snapshot.rangeToUtc)),$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now),NULL,$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(household_id,provider,resource) DO UPDATE SET cursor_value=excluded.cursor_value,high_watermark_utc=excluded.high_watermark_utc,last_attempt_at_utc=excluded.last_attempt_at_utc,last_success_at_utc=excluded.last_success_at_utc,last_error=NULL,updated_at_utc=excluded.updated_at_utc;")
    }
    if ($Snapshot.syncRun) { $Sql.Add((New-DriveOSSqliteSyncRunSql -Run $Snapshot.syncRun)) }
    $Sql.Add('COMMIT;')
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Set-DriveOSSqliteIntegrationSyncRun {
    param($Repository,$Run)
    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    $ErrorValue = if ($Run.status -eq 'failed') { [string]$Run.errorMessage } else { $null }
    $Sql = New-Object System.Collections.Generic.List[string]
    $Sql.Add('PRAGMA foreign_keys=ON;')
    $Sql.Add('BEGIN IMMEDIATE;')
    $Sql.Add("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Run.householdId)),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add((New-DriveOSSqliteSyncRunSql -Run $Run))
    $Sql.Add("INSERT INTO integration_sync_cursors(household_id,provider,resource,cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error,updated_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Run.householdId)),$(ConvertTo-SqlLiteral ([string]$Run.provider)),$(ConvertTo-SqlLiteral ([string]$Run.resource)),NULL,NULL,$(ConvertTo-SqlLiteral ([string]$Run.startedAtUtc)),NULL,$(ConvertTo-SqlLiteral $ErrorValue),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(household_id,provider,resource) DO UPDATE SET last_attempt_at_utc=excluded.last_attempt_at_utc,last_error=excluded.last_error,updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add('COMMIT;')
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Get-DriveOSSqliteTessieDrives {
    param($Repository,[long]$FromEpoch)
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT raw_payload_json FROM drives WHERE provider='tessie' AND started_at_epoch >= $FromEpoch ORDER BY started_at_epoch DESC,id;" -Json)
    return @($Rows | ForEach-Object { $_.raw_payload_json | ConvertFrom-Json })
}

function Get-DriveOSSqliteTessieCharges {
    param($Repository,[long]$FromEpoch)
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT raw_payload_json FROM charging_sessions WHERE provider='tessie' AND started_at_epoch >= $FromEpoch ORDER BY started_at_epoch DESC,id;" -Json)
    return @($Rows | ForEach-Object { $_.raw_payload_json | ConvertFrom-Json })
}

function Get-DriveOSSqliteTessieAuditRows {
    param(
        $Repository,
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,
        [Parameter(Mandatory=$true)][long]$FromEpoch,
        [Parameter(Mandatory=$true)][long]$ToEpoch,
        [string]$VehicleId
    )
    $Table = if ($Resource -eq 'drives') { 'drives' } else { 'charging_sessions' }
    $VehicleFilter = if ($VehicleId) { " AND vehicle_id=$(ConvertTo-SqlLiteral $VehicleId)" } else { '' }
    $Sql = "SELECT * FROM $Table WHERE provider='tessie'$VehicleFilter AND started_at_epoch >= $FromEpoch AND started_at_epoch <= $ToEpoch ORDER BY started_at_epoch,id;"
    return @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
}

function Get-DriveOSSqliteIntegrationSyncCursor {
    param($Repository,[string]$HouseholdId,[string]$Provider,[string]$Resource)
    $Sql = "SELECT cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error FROM integration_sync_cursors WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND provider=$(ConvertTo-SqlLiteral $Provider) AND resource=$(ConvertTo-SqlLiteral $Resource);"
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
    if (-not $Rows.Count) { return $null }
    return $Rows[0]
}

function Get-DriveOSSqliteHistory {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT payload_json FROM listening_history ORDER BY played_at,id;' -Json)
    return @($rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Add-DriveOSSqliteHistoryRecord {
    param($Repository,$Record)
    $payload = $Record | ConvertTo-Json -Depth 20 -Compress
    $sql = "INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES($(ConvertTo-SqlLiteral ([string]$Record.id)),$(ConvertTo-SqlLiteral ([string]$Record.played_at)),$(ConvertTo-SqlLiteral $payload));"
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteSoundtracks {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT payload_json FROM drive_soundtracks ORDER BY drive_ended_at DESC,drive_id;' -Json)
    return @($rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Set-DriveOSSqliteSoundtrack {
    param($Repository,$Record)
    $payload=$Record|ConvertTo-Json -Depth 30 -Compress
    $updatedAt=[DateTimeOffset]::UtcNow.ToString('o')
    $sql="INSERT OR REPLACE INTO drive_soundtracks(drive_id,drive_started_at,drive_ended_at,status,payload_json,updated_at) VALUES($(ConvertTo-SqlLiteral ([string]$Record.driveId)),$(ConvertTo-SqlLiteral ([string]$Record.startedAt)),$(ConvertTo-SqlLiteral ([string]$Record.endedAt)),$(ConvertTo-SqlLiteral ([string]$Record.status)),$(ConvertTo-SqlLiteral $payload),$(ConvertTo-SqlLiteral $updatedAt));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteAliases {
    param($Repository)
    return @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT location,label FROM place_aliases ORDER BY location;' -Json)
}

function Set-DriveOSSqliteAliases {
    param($Repository,[object[]]$Entries)
    $statements = @('BEGIN IMMEDIATE;','DELETE FROM place_aliases;')
    foreach($entry in @($Entries)){ $statements += "INSERT INTO place_aliases(location,label) VALUES($(ConvertTo-SqlLiteral ([string]$entry.location)),$(ConvertTo-SqlLiteral ([string]$entry.label)));" }
    $statements += 'COMMIT;'
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($statements -join "`n")
}

function Get-DriveOSSqliteSettings {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT value_json FROM settings WHERE key='charging';" -Json)
    if (-not $rows.Count) { return $null }
    return $rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSSqliteSettings {
    param($Repository,$Settings)
    $payload=$Settings|ConvertTo-Json -Depth 20 -Compress
    $sql="INSERT OR REPLACE INTO settings(key,value_json) VALUES('charging',$(ConvertTo-SqlLiteral $payload));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteDashboardLayout {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT value_json FROM settings WHERE key='dashboard-layout';" -Json)
    if (-not $rows.Count) { return $null }
    return $rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSSqliteDashboardLayout {
    param($Repository,$LayoutRecord)
    $payload=$LayoutRecord|ConvertTo-Json -Depth 20 -Compress
    $sql="INSERT OR REPLACE INTO settings(key,value_json) VALUES('dashboard-layout',$(ConvertTo-SqlLiteral $payload));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteState {
    param($Repository,[Parameter(Mandatory=$true)][string]$Key)
    $Sql = "SELECT value_json FROM app_state WHERE key=$(ConvertTo-SqlLiteral $Key);"
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
    if (-not $Rows.Count) { return $null }
    return $Rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSSqliteState {
    param($Repository,[Parameter(Mandatory=$true)][string]$Key,[Parameter(Mandatory=$true)]$Value)
    $Payload = $Value | ConvertTo-Json -Depth 20 -Compress
    $UpdatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $Sql = "INSERT INTO app_state(key,value_json,updated_at) VALUES($(ConvertTo-SqlLiteral $Key),$(ConvertTo-SqlLiteral $Payload),$(ConvertTo-SqlLiteral $UpdatedAt)) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;"
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql
}

function Set-DriveOSSqliteIntegrityAuditRun {
    param($Repository,[Parameter(Mandatory=$true)]$Run)
    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    $ReportJson = $Run.report | ConvertTo-Json -Depth 30 -Compress
    $Sql = @(
        'PRAGMA foreign_keys=ON;'
        'BEGIN IMMEDIATE;'
        "INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Run.householdId)),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"
        "INSERT INTO integrity_audit_runs(id,household_id,audit_kind,status,ready_for_read_canary,range_from_utc,range_to_utc,generated_at_utc,completed_at_utc,report_json,created_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Run.id)),$(ConvertTo-SqlLiteral ([string]$Run.householdId)),$(ConvertTo-SqlLiteral ([string]$Run.auditKind)),$(ConvertTo-SqlLiteral ([string]$Run.status)),$(if($Run.readyForReadCanary){1}else{0}),$(ConvertTo-SqlLiteral ([string]$Run.rangeFromUtc)),$(ConvertTo-SqlLiteral ([string]$Run.rangeToUtc)),$(ConvertTo-SqlLiteral ([string]$Run.generatedAtUtc)),$(ConvertTo-SqlLiteral ([string]$Run.completedAtUtc)),$(ConvertTo-SqlLiteral $ReportJson),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET status=excluded.status,ready_for_read_canary=excluded.ready_for_read_canary,range_from_utc=excluded.range_from_utc,range_to_utc=excluded.range_to_utc,generated_at_utc=excluded.generated_at_utc,completed_at_utc=excluded.completed_at_utc,report_json=excluded.report_json;"
        'COMMIT;'
    )
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Get-DriveOSSqliteLatestIntegrityAuditRun {
    param($Repository,[string]$HouseholdId,[string]$AuditKind)
    $Sql = "SELECT id,audit_kind,status,ready_for_read_canary,range_from_utc,range_to_utc,generated_at_utc,completed_at_utc,report_json FROM integrity_audit_runs WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND audit_kind=$(ConvertTo-SqlLiteral $AuditKind) ORDER BY completed_at_utc DESC,id DESC LIMIT 1;"
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
    if (-not $Rows.Count) { return $null }
    $Row = $Rows[0]
    return [PSCustomObject]@{ id=$Row.id; auditKind=$Row.audit_kind; status=$Row.status; readyForReadCanary=([int]$Row.ready_for_read_canary -eq 1); rangeFromUtc=$Row.range_from_utc; rangeToUtc=$Row.range_to_utc; generatedAtUtc=$Row.generated_at_utc; completedAtUtc=$Row.completed_at_utc; report=($Row.report_json | ConvertFrom-Json) }
}

function Test-DriveOSSqliteIntegrity {
    param($Repository)
    $rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'PRAGMA integrity_check;' -Json)
    return ($rows.Count -eq 1 -and $rows[0].integrity_check -eq 'ok')
}

function Import-DriveOSSqliteData {
    param($Repository,[object[]]$History=@(),[object[]]$Aliases=@(),$Settings)
    $sql=New-Object System.Collections.Generic.List[string]
    $sql.Add('BEGIN IMMEDIATE;');$sql.Add('DELETE FROM listening_history;');$sql.Add('DELETE FROM place_aliases;');$sql.Add('DELETE FROM settings;')
    foreach($record in @($History)){
        $payload=$record|ConvertTo-Json -Depth 20 -Compress
        $sql.Add("INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES($(ConvertTo-SqlLiteral ([string]$record.id)),$(ConvertTo-SqlLiteral ([string]$record.played_at)),$(ConvertTo-SqlLiteral $payload));")
    }
    foreach($entry in @($Aliases)){$sql.Add("INSERT INTO place_aliases(location,label) VALUES($(ConvertTo-SqlLiteral ([string]$entry.location)),$(ConvertTo-SqlLiteral ([string]$entry.label)));")}
    if($Settings){$payload=$Settings|ConvertTo-Json -Depth 20 -Compress;$sql.Add("INSERT INTO settings(key,value_json) VALUES('charging',$(ConvertTo-SqlLiteral $payload));")}
    $sql.Add('COMMIT;')
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($sql -join "`n")
}

Export-ModuleMember -Function Invoke-DriveOSSqlite,Initialize-DriveOSSqlite,Set-DriveOSSqliteTessieSnapshot,Set-DriveOSSqliteIntegrationSyncRun,Get-DriveOSSqliteTessieDrives,Get-DriveOSSqliteTessieCharges,Get-DriveOSSqliteTessieAuditRows,Get-DriveOSSqliteIntegrationSyncCursor,Get-DriveOSSqliteHistory,Add-DriveOSSqliteHistoryRecord,Get-DriveOSSqliteSoundtracks,Set-DriveOSSqliteSoundtrack,Get-DriveOSSqliteAliases,Set-DriveOSSqliteAliases,Get-DriveOSSqliteSettings,Set-DriveOSSqliteSettings,Get-DriveOSSqliteDashboardLayout,Set-DriveOSSqliteDashboardLayout,Get-DriveOSSqliteState,Set-DriveOSSqliteState,Set-DriveOSSqliteIntegrityAuditRun,Get-DriveOSSqliteLatestIntegrityAuditRun,Test-DriveOSSqliteIntegrity,Import-DriveOSSqliteData
