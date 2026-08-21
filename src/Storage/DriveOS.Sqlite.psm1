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
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT raw_payload_json FROM drives WHERE provider IN ('tessie','google_timeline','journeydeck_recorder') AND started_at_epoch >= $FromEpoch ORDER BY started_at_epoch DESC,id;" -Json)
    return @($Rows | ForEach-Object { $_.raw_payload_json | ConvertFrom-Json })
}

function Set-DriveOSSqliteReconstructedDrives {
    param($Repository,$Batch)
    $Now=[string]$Batch.observedAtUtc
    $Sql=New-Object System.Collections.Generic.List[string]
    $Sql.Add('PRAGMA foreign_keys=ON;');$Sql.Add('BEGIN IMMEDIATE;')
    $Sql.Add("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $Batch.householdId),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add("INSERT INTO vehicles(id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $Batch.vehicleId),$(ConvertTo-SqlLiteral $Batch.householdId),'google_timeline',$(ConvertTo-SqlLiteral $Batch.providerVehicleId),NULL,$(ConvertTo-SqlLiteral $Batch.displayName),$(ConvertTo-SqlLiteral $Now),'{`"source`":`"google_timeline`"}',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,observed_at_utc=excluded.observed_at_utc,updated_at_utc=excluded.updated_at_utc;")
    foreach($Drive in @($Batch.records)){
        $Values=@($Drive.id,$Batch.householdId,$Batch.vehicleId,'google_timeline',$Drive.providerDriveId,$Drive.legacyDriveId,$Drive.startedAtUtc,$Drive.endedAtUtc,$Drive.startedAtEpoch,$Drive.endedAtEpoch,$Drive.startingLocation,$Drive.endingLocation,$Drive.startingLatitude,$Drive.startingLongitude,$Drive.endingLatitude,$Drive.endingLongitude,$null,$null,$Drive.distanceMiles,$null,$null,$null,'Reconstructed','Google Timeline',$Drive.rawPayloadJson,$null,$Now,$Now)|ForEach-Object{ConvertTo-SqlLiteral $_}
        $Sql.Add("INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES($($Values -join ',')) ON CONFLICT(id) DO UPDATE SET raw_payload_json=excluded.raw_payload_json,distance_miles=excluded.distance_miles,updated_at_utc=excluded.updated_at_utc;")
    }
    $Sql.Add('COMMIT;');$null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Get-DriveOSSqliteJourneyCollections {
    param($Repository,[string]$HouseholdId)
    $Sql = "SELECT c.id,c.name,c.description,c.created_at_utc,c.updated_at_utc,d.legacy_drive_id,m.sort_order FROM journey_collections c LEFT JOIN journey_collection_drives m ON m.collection_id=c.id LEFT JOIN drives d ON d.id=m.drive_id WHERE c.household_id=$(ConvertTo-SqlLiteral $HouseholdId) ORDER BY c.updated_at_utc DESC,c.id,m.sort_order,m.drive_id;"
    $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
    $Collections = @()
    foreach ($Group in @($Rows | Group-Object id)) {
        $First = $Group.Group[0]
        $Collections += [PSCustomObject]@{
            id = $First.id; name = $First.name; description = $First.description
            driveIds = @($Group.Group | Where-Object { $_.legacy_drive_id } | ForEach-Object { $_.legacy_drive_id })
            createdAtUtc = $First.created_at_utc; updatedAtUtc = $First.updated_at_utc
        }
    }
    return @($Collections)
}

function Set-DriveOSSqliteJourneyCollection {
    param($Repository,$Collection,[string]$HouseholdId)
    $Now = [string]$Collection.updatedAtUtc
    $DriveIds = @($Collection.driveIds)
    $ExistingOwners = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT household_id FROM journey_collections WHERE id=$(ConvertTo-SqlLiteral ([string]$Collection.id));" -Json)
    if ($ExistingOwners.Count -and "$($ExistingOwners[0].household_id)" -ne $HouseholdId) { throw 'Collection belongs to another household.' }
    if ($DriveIds.Count) {
        $IdList = @($DriveIds | ForEach-Object { ConvertTo-SqlLiteral ([string]$_) }) -join ','
        $Rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT legacy_drive_id FROM drives WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND legacy_drive_id IN ($IdList);" -Json)
        if ($Rows.Count -ne $DriveIds.Count) { throw 'One or more collection drives no longer exist.' }
    }
    $Sql = New-Object System.Collections.Generic.List[string]
    $Sql.Add('PRAGMA foreign_keys=ON;'); $Sql.Add('BEGIN IMMEDIATE;')
    $Sql.Add("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $HouseholdId),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add("INSERT INTO journey_collections(id,household_id,name,description,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral ([string]$Collection.id)),$(ConvertTo-SqlLiteral $HouseholdId),$(ConvertTo-SqlLiteral ([string]$Collection.name)),$(ConvertTo-SqlLiteral ([string]$Collection.description)),$(ConvertTo-SqlLiteral ([string]$Collection.createdAtUtc)),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,updated_at_utc=excluded.updated_at_utc WHERE journey_collections.household_id=excluded.household_id;")
    $Sql.Add("DELETE FROM journey_collection_drives WHERE collection_id=$(ConvertTo-SqlLiteral ([string]$Collection.id)) AND EXISTS(SELECT 1 FROM journey_collections WHERE id=$(ConvertTo-SqlLiteral ([string]$Collection.id)) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId));")
    for ($Index=0; $Index -lt $DriveIds.Count; $Index++) {
        $Sql.Add("INSERT INTO journey_collection_drives(collection_id,drive_id,sort_order,added_at_utc) SELECT $(ConvertTo-SqlLiteral ([string]$Collection.id)),id,$Index,$(ConvertTo-SqlLiteral $Now) FROM drives WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND legacy_drive_id=$(ConvertTo-SqlLiteral ([string]$DriveIds[$Index]));")
    }
    $Sql.Add('COMMIT;')
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Remove-DriveOSSqliteJourneyCollection {
    param($Repository,[string]$CollectionId,[string]$HouseholdId)
    $Sql = "PRAGMA foreign_keys=ON;`nBEGIN IMMEDIATE;`nDELETE FROM journey_collections WHERE id=$(ConvertTo-SqlLiteral $CollectionId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId);`nCOMMIT;"
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql
}

function Get-DriveOSSqliteJourneyAttachments {
    param($Repository,[string]$CollectionId,[string]$HouseholdId,[string]$AttachmentId,[switch]$IncludeData)
    $Fields=if($IncludeData){'id,collection_id,file_name,content_type,byte_length,data_base64,created_at_utc'}else{'id,collection_id,file_name,content_type,byte_length,created_at_utc'}
    $Where=if($AttachmentId){"id=$(ConvertTo-SqlLiteral $AttachmentId)"}else{"collection_id=$(ConvertTo-SqlLiteral $CollectionId)"}
    $Rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT $Fields FROM journey_attachments WHERE $Where AND household_id=$(ConvertTo-SqlLiteral $HouseholdId) ORDER BY created_at_utc,id;" -Json)
    return @($Rows|ForEach-Object{[PSCustomObject]@{id=$_.id;collectionId=$_.collection_id;fileName=$_.file_name;contentType=$_.content_type;byteLength=[int]$_.byte_length;dataBase64=$(if($IncludeData){$_.data_base64}else{$null});createdAtUtc=$_.created_at_utc}})
}

function Set-DriveOSSqliteJourneyAttachment {
    param($Repository,$Record,[string]$HouseholdId)
    $Sql="INSERT INTO journey_attachments(id,household_id,collection_id,file_name,content_type,byte_length,data_base64,created_at_utc) SELECT $(ConvertTo-SqlLiteral $Record.id),$(ConvertTo-SqlLiteral $HouseholdId),$(ConvertTo-SqlLiteral $Record.collectionId),$(ConvertTo-SqlLiteral $Record.fileName),$(ConvertTo-SqlLiteral $Record.contentType),$($Record.byteLength),$(ConvertTo-SqlLiteral $Record.dataBase64),$(ConvertTo-SqlLiteral $Record.createdAtUtc) WHERE EXISTS(SELECT 1 FROM journey_collections WHERE id=$(ConvertTo-SqlLiteral $Record.collectionId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql
}

function Remove-DriveOSSqliteJourneyAttachment {
    param($Repository,[string]$AttachmentId,[string]$HouseholdId)
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "DELETE FROM journey_attachments WHERE id=$(ConvertTo-SqlLiteral $AttachmentId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId);"
}

function Get-DriveOSSqliteMemories {
    param($Repository,[string]$HouseholdId)
    $Sql="SELECT m.id,m.name,m.notes,m.artwork_key,m.created_at_utc,m.updated_at_utc,c.id AS collection_id,mc.sort_order FROM memories m LEFT JOIN memory_collections mc ON mc.memory_id=m.id LEFT JOIN journey_collections c ON c.id=mc.collection_id WHERE m.household_id=$(ConvertTo-SqlLiteral $HouseholdId) ORDER BY m.updated_at_utc DESC,m.id,mc.sort_order,c.id;"
    $Rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql -Json)
    $Result=@();foreach($Group in @($Rows|Group-Object id)){$First=$Group.Group[0];$Result += [PSCustomObject]@{id=$First.id;name=$First.name;notes=$First.notes;artworkKey=$First.artwork_key;collectionIds=@($Group.Group|Where-Object collection_id|ForEach-Object collection_id);createdAtUtc=$First.created_at_utc;updatedAtUtc=$First.updated_at_utc}}
    return @($Result)
}

function Set-DriveOSSqliteMemory {
    param($Repository,$Memory,[string]$HouseholdId)
    $CollectionIds=@($Memory.collectionIds);$Now=[string]$Memory.updatedAtUtc
    if($CollectionIds.Count){$IdList=@($CollectionIds|ForEach-Object{ConvertTo-SqlLiteral "$_"})-join ',';$Rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT id FROM journey_collections WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND id IN ($IdList);" -Json);if($Rows.Count -ne $CollectionIds.Count){throw 'One or more memory collections no longer exist.'}}
    $Sql=[Collections.Generic.List[string]]::new();$Sql.Add('PRAGMA foreign_keys=ON;');$Sql.Add('BEGIN IMMEDIATE;')
    $Sql.Add("INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $HouseholdId),'Primary household',$(ConvertTo-SqlLiteral $Now),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;")
    $Sql.Add("INSERT INTO memories(id,household_id,name,notes,artwork_key,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $Memory.id),$(ConvertTo-SqlLiteral $HouseholdId),$(ConvertTo-SqlLiteral $Memory.name),$(ConvertTo-SqlLiteral $Memory.notes),$(ConvertTo-SqlLiteral $Memory.artworkKey),$(ConvertTo-SqlLiteral $Memory.createdAtUtc),$(ConvertTo-SqlLiteral $Now)) ON CONFLICT(id) DO UPDATE SET name=excluded.name,notes=excluded.notes,artwork_key=excluded.artwork_key,updated_at_utc=excluded.updated_at_utc WHERE memories.household_id=excluded.household_id;")
    $Sql.Add("DELETE FROM memory_collections WHERE memory_id=$(ConvertTo-SqlLiteral $Memory.id) AND EXISTS(SELECT 1 FROM memories WHERE id=$(ConvertTo-SqlLiteral $Memory.id) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId));")
    for($Index=0;$Index -lt $CollectionIds.Count;$Index++){$Sql.Add("INSERT INTO memory_collections(memory_id,collection_id,sort_order,added_at_utc) SELECT $(ConvertTo-SqlLiteral $Memory.id),id,$Index,$(ConvertTo-SqlLiteral $Now) FROM journey_collections WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND id=$(ConvertTo-SqlLiteral $CollectionIds[$Index]);")}
    $Sql.Add('COMMIT;');$null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($Sql -join "`n")
}

function Remove-DriveOSSqliteMemory { param($Repository,[string]$MemoryId,[string]$HouseholdId) $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; DELETE FROM memories WHERE id=$(ConvertTo-SqlLiteral $MemoryId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId); COMMIT;" }

function Get-DriveOSSqliteMemoryAttachments {
    param($Repository,[string]$MemoryId,[string]$HouseholdId,[string]$AttachmentId,[switch]$IncludeData)
    $Fields=if($IncludeData){'id,memory_id,file_name,content_type,byte_length,data_base64,created_at_utc'}else{'id,memory_id,file_name,content_type,byte_length,created_at_utc'};$Where=if($AttachmentId){"id=$(ConvertTo-SqlLiteral $AttachmentId)"}else{"memory_id=$(ConvertTo-SqlLiteral $MemoryId)"}
    $Rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT $Fields FROM memory_attachments WHERE $Where AND household_id=$(ConvertTo-SqlLiteral $HouseholdId) ORDER BY created_at_utc,id;" -Json)
    return @($Rows|ForEach-Object{[PSCustomObject]@{id=$_.id;memoryId=$_.memory_id;fileName=$_.file_name;contentType=$_.content_type;byteLength=[int]$_.byte_length;dataBase64=$(if($IncludeData){$_.data_base64}else{$null});createdAtUtc=$_.created_at_utc}})
}

function Set-DriveOSSqliteMemoryAttachment { param($Repository,$Record,[string]$HouseholdId) $Sql="INSERT INTO memory_attachments(id,household_id,memory_id,file_name,content_type,byte_length,data_base64,created_at_utc) SELECT $(ConvertTo-SqlLiteral $Record.id),$(ConvertTo-SqlLiteral $HouseholdId),$(ConvertTo-SqlLiteral $Record.memoryId),$(ConvertTo-SqlLiteral $Record.fileName),$(ConvertTo-SqlLiteral $Record.contentType),$($Record.byteLength),$(ConvertTo-SqlLiteral $Record.dataBase64),$(ConvertTo-SqlLiteral $Record.createdAtUtc) WHERE EXISTS(SELECT 1 FROM memories WHERE id=$(ConvertTo-SqlLiteral $Record.memoryId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId));";$null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql }
function Remove-DriveOSSqliteMemoryAttachment { param($Repository,[string]$AttachmentId,[string]$HouseholdId) $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "DELETE FROM memory_attachments WHERE id=$(ConvertTo-SqlLiteral $AttachmentId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId);" }

function Get-DriveOSSqliteMemorySuggestions {
    param($Repository,[string]$HouseholdId,[string]$Status='suggested')
    $Rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT id,kind,suggestion_key,title,description,payload_json,status,created_at_utc,updated_at_utc FROM memory_suggestions WHERE household_id=$(ConvertTo-SqlLiteral $HouseholdId) AND status=$(ConvertTo-SqlLiteral $Status) ORDER BY kind,updated_at_utc DESC,id;" -Json)
    return @($Rows|ForEach-Object{[PSCustomObject]@{id=$_.id;kind=$_.kind;suggestionKey=$_.suggestion_key;title=$_.title;description=$_.description;payload=$($_.payload_json|ConvertFrom-Json);status=$_.status;createdAtUtc=$_.created_at_utc;updatedAtUtc=$_.updated_at_utc}})
}

function Set-DriveOSSqliteMemorySuggestion {
    param($Repository,$Suggestion,[string]$HouseholdId)
    $Payload=$Suggestion.payload|ConvertTo-Json -Depth 12 -Compress;$Sql="INSERT INTO memory_suggestions(id,household_id,kind,suggestion_key,title,description,payload_json,status,created_at_utc,updated_at_utc) VALUES($(ConvertTo-SqlLiteral $Suggestion.id),$(ConvertTo-SqlLiteral $HouseholdId),$(ConvertTo-SqlLiteral $Suggestion.kind),$(ConvertTo-SqlLiteral $Suggestion.suggestionKey),$(ConvertTo-SqlLiteral $Suggestion.title),$(ConvertTo-SqlLiteral $Suggestion.description),$(ConvertTo-SqlLiteral $Payload),$(ConvertTo-SqlLiteral $Suggestion.status),$(ConvertTo-SqlLiteral $Suggestion.createdAtUtc),$(ConvertTo-SqlLiteral $Suggestion.updatedAtUtc)) ON CONFLICT(household_id,suggestion_key) DO UPDATE SET title=excluded.title,description=excluded.description,payload_json=excluded.payload_json,updated_at_utc=excluded.updated_at_utc;";$null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $Sql
}
function Set-DriveOSSqliteMemorySuggestionStatus { param($Repository,[string]$SuggestionId,[string]$Status,[string]$HouseholdId) $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "UPDATE memory_suggestions SET status=$(ConvertTo-SqlLiteral $Status),updated_at_utc=$(ConvertTo-SqlLiteral ([DateTimeOffset]::UtcNow.ToString('o'))) WHERE id=$(ConvertTo-SqlLiteral $SuggestionId) AND household_id=$(ConvertTo-SqlLiteral $HouseholdId);" }

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

Export-ModuleMember -Function Invoke-DriveOSSqlite,Initialize-DriveOSSqlite,Set-DriveOSSqliteTessieSnapshot,Set-DriveOSSqliteIntegrationSyncRun,Get-DriveOSSqliteTessieDrives,Set-DriveOSSqliteReconstructedDrives,Get-DriveOSSqliteTessieCharges,Get-DriveOSSqliteTessieAuditRows,Get-DriveOSSqliteIntegrationSyncCursor,Get-DriveOSSqliteHistory,Add-DriveOSSqliteHistoryRecord,Get-DriveOSSqliteSoundtracks,Set-DriveOSSqliteSoundtrack,Get-DriveOSSqliteAliases,Set-DriveOSSqliteAliases,Get-DriveOSSqliteSettings,Set-DriveOSSqliteSettings,Get-DriveOSSqliteDashboardLayout,Set-DriveOSSqliteDashboardLayout,Get-DriveOSSqliteState,Set-DriveOSSqliteState,Set-DriveOSSqliteIntegrityAuditRun,Get-DriveOSSqliteLatestIntegrityAuditRun,Test-DriveOSSqliteIntegrity,Import-DriveOSSqliteData,Get-DriveOSSqliteJourneyCollections,Set-DriveOSSqliteJourneyCollection,Remove-DriveOSSqliteJourneyCollection,Get-DriveOSSqliteJourneyAttachments,Set-DriveOSSqliteJourneyAttachment,Remove-DriveOSSqliteJourneyAttachment,Get-DriveOSSqliteMemories,Set-DriveOSSqliteMemory,Remove-DriveOSSqliteMemory,Get-DriveOSSqliteMemoryAttachments,Set-DriveOSSqliteMemoryAttachment,Remove-DriveOSSqliteMemoryAttachment,Get-DriveOSSqliteMemorySuggestions,Set-DriveOSSqliteMemorySuggestion,Set-DriveOSSqliteMemorySuggestionStatus
