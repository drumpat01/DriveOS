Set-StrictMode -Version 2.0
Import-Module (Join-Path $PSScriptRoot 'DriveOS.Migrations.psm1') -Force

function Get-DriveOSTursoHttpUrl {
    param([Parameter(Mandatory=$true)][string]$DatabaseUrl)

    $Value = "$DatabaseUrl".Trim()

    if ($Value -notmatch '^libsql://([A-Za-z0-9.-]+)(?::\d+)?/?$') {
        throw "TURSO_DATABASE_URL must be a valid libsql:// Turso database URL."
    }

    return "https://$($Matches[1])"
}

function Get-DriveOSTursoHttpTimeoutSeconds {
    $TimeoutSeconds = 30
    $Configured = [Environment]::GetEnvironmentVariable('JOURNEYDECK_TURSO_HTTP_TIMEOUT_SECONDS')
    if ($Configured -and (-not [int]::TryParse($Configured,[ref]$TimeoutSeconds) -or $TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 300)) {
        throw 'JOURNEYDECK_TURSO_HTTP_TIMEOUT_SECONDS must be between 1 and 300.'
    }
    return $TimeoutSeconds
}

function Get-DriveOSTursoBatchStatementLimit {
    $Limit = 100
    $Configured = [Environment]::GetEnvironmentVariable('JOURNEYDECK_TURSO_BATCH_STATEMENTS')
    if ($Configured -and (-not [int]::TryParse($Configured,[ref]$Limit) -or $Limit -lt 1 -or $Limit -gt 500)) {
        throw 'JOURNEYDECK_TURSO_BATCH_STATEMENTS must be between 1 and 500.'
    }
    return $Limit
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

function New-DriveOSTursoStatementPayload {
    param([Parameter(Mandatory=$true)]$Statement)
    $Stmt = [ordered]@{ sql = "$($Statement.Sql)" }
    if ($Statement.PSObject.Properties['Args']) {
        $Stmt.args = @($Statement.Args | ForEach-Object { New-DriveOSTursoTextArgument -Value $_ })
    }
    return [PSCustomObject]$Stmt
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
    $Requests = @()

    foreach ($Statement in $Statements) {
        $Stmt = [ordered]@{ sql = "$($Statement.Sql)" }

        if ($Statement.PSObject.Properties["Args"]) {
            $Stmt.args = @(
                $Statement.Args | ForEach-Object {
                    New-DriveOSTursoTextArgument -Value $_
                }
            )
        }

        $Requests += [PSCustomObject]@{
            type = "execute"
            stmt = [PSCustomObject]$Stmt
        }
    }

    $Requests += [PSCustomObject]@{ type = "close" }

    $Payload = [PSCustomObject]@{
        requests = @($Requests)
    } | ConvertTo-Json -Depth 20 -Compress

    $Response = Invoke-RestMethod `
        -Uri "$BaseUrl/v2/pipeline" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $($Repository.TursoAuthToken)" } `
        -ContentType "application/json" `
        -Body $Payload `
        -TimeoutSec (Get-DriveOSTursoHttpTimeoutSeconds)

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

function Invoke-DriveOSTursoTransactionalBatch {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][object[]]$Statements
    )

    if (-not $Statements.Count) { return }
    if (-not $Repository.TursoDatabaseUrl -or -not $Repository.TursoAuthToken) { throw 'Turso repository credentials are incomplete.' }

    $Steps = @([PSCustomObject]@{ stmt = [PSCustomObject]@{ sql = 'BEGIN IMMEDIATE;' } })
    $PreviousStep = 0
    foreach ($Statement in $Statements) {
        $Steps += [PSCustomObject]@{
            condition = [PSCustomObject]@{ type = 'ok'; step = $PreviousStep }
            stmt = New-DriveOSTursoStatementPayload -Statement $Statement
        }
        $PreviousStep++
    }
    $CommitStep = $Steps.Count
    $Steps += [PSCustomObject]@{
        condition = [PSCustomObject]@{ type = 'ok'; step = $PreviousStep }
        stmt = [PSCustomObject]@{ sql = 'COMMIT;' }
    }
    $Steps += [PSCustomObject]@{
        condition = [PSCustomObject]@{ type = 'not'; cond = [PSCustomObject]@{ type = 'ok'; step = $CommitStep } }
        stmt = [PSCustomObject]@{ sql = 'ROLLBACK;' }
    }

    $Payload = [PSCustomObject]@{
        requests = @(
            [PSCustomObject]@{ type = 'batch'; batch = [PSCustomObject]@{ steps = @($Steps) } },
            [PSCustomObject]@{ type = 'close' }
        )
    } | ConvertTo-Json -Depth 30 -Compress
    $BaseUrl = Get-DriveOSTursoHttpUrl -DatabaseUrl $Repository.TursoDatabaseUrl
    $Response = Invoke-RestMethod -Uri "$BaseUrl/v2/pipeline" -Method Post -Headers @{ Authorization = "Bearer $($Repository.TursoAuthToken)" } -ContentType 'application/json' -Body $Payload -TimeoutSec (Get-DriveOSTursoHttpTimeoutSeconds)
    $PipelineResult = $Response.results[0]
    if (-not $PipelineResult -or $PipelineResult.type -ne 'ok' -or $PipelineResult.response.type -ne 'batch') {
        $Message = 'Turso transactional batch failed.'
        if ($PipelineResult -and $PipelineResult.PSObject.Properties['error'] -and $PipelineResult.error.message) { $Message = $PipelineResult.error.message }
        throw $Message
    }

    $BatchResult = $PipelineResult.response.result
    for ($Index = 0; $Index -le $CommitStep; $Index++) {
        $StepError = $BatchResult.step_errors[$Index]
        if ($null -ne $StepError) { throw "Turso transactional batch failed at step ${Index}: $($StepError.message)" }
    }
    if ($null -eq $BatchResult.step_results[$CommitStep]) { throw 'Turso transactional batch did not commit.' }
}

function Invoke-DriveOSTursoStatementChunks {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][AllowEmptyCollection()][object[]]$Statements,
        [int]$MaximumStatements = (Get-DriveOSTursoBatchStatementLimit)
    )

    if (-not $Statements.Count) { return }
    for ($Offset = 0; $Offset -lt $Statements.Count; $Offset += $MaximumStatements) {
        $Last = [math]::Min($Statements.Count - 1,$Offset + $MaximumStatements - 1)
        Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements @($Statements[$Offset..$Last])
    }
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

    Invoke-DriveOSTursoExecute -Repository $Repository -Sql 'CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);'
    $Applied = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT version FROM schema_migrations ORDER BY version;' | ForEach-Object { [int]$_.version })

    foreach ($Migration in @(Get-DriveOSOrderedMigrations)) {
        if ($Migration.Version -in $Applied) { continue }
        $Statements = @($Migration.Statements | ForEach-Object { [PSCustomObject]@{ Sql = $_ } })
        $Statements += [PSCustomObject]@{
            Sql = 'INSERT INTO schema_migrations(version,applied_at) VALUES(?,?);'
            Args = @($Migration.Version,[DateTimeOffset]::UtcNow.ToString('o'))
        }
        Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $Statements
    }
}

function New-DriveOSTursoSyncRunStatement {
    param([Parameter(Mandatory=$true)]$Run)
    return [PSCustomObject]@{
        Sql = 'INSERT INTO integration_sync_runs(id,household_id,provider,resource,idempotency_key,status,range_from_utc,range_to_utc,records_seen,records_written,started_at_utc,completed_at_utc,error_message) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,range_from_utc=excluded.range_from_utc,range_to_utc=excluded.range_to_utc,records_seen=excluded.records_seen,records_written=excluded.records_written,started_at_utc=excluded.started_at_utc,completed_at_utc=excluded.completed_at_utc,error_message=excluded.error_message;'
        Args = @($Run.id,$Run.householdId,$Run.provider,$Run.resource,$Run.idempotencyKey,$Run.status,$Run.rangeFromUtc,$Run.rangeToUtc,$Run.recordsSeen,$Run.recordsWritten,$Run.startedAtUtc,$Run.completedAtUtc,$Run.errorMessage)
    }
}

function Set-DriveOSTursoTessieSnapshot {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Snapshot)

    $Now = [string]$Snapshot.syncedAtUtc
    $HouseholdId = [string]$Snapshot.householdId
    $Vehicle = $Snapshot.vehicle
    $IdentityStatements = @()
    $IdentityStatements += [PSCustomObject]@{
        Sql = "INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"
        Args = @($HouseholdId,$Now,$Now)
    }
    $IdentityStatements += [PSCustomObject]@{
        Sql = "INSERT INTO vehicles(id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc) VALUES(?,?,'tessie',?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET vin=excluded.vin,display_name=excluded.display_name,observed_at_utc=excluded.observed_at_utc,raw_payload_json=excluded.raw_payload_json,updated_at_utc=excluded.updated_at_utc;"
        Args = @($Vehicle.id,$HouseholdId,$Vehicle.providerVehicleId,$Vehicle.vin,$Vehicle.displayName,$Vehicle.observedAtUtc,$Vehicle.rawPayloadJson,$Now,$Now)
    }
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $IdentityStatements

    $RecordStatements = @()
    foreach ($Drive in @($Snapshot.drives)) {
        $RecordStatements += [PSCustomObject]@{
            Sql = "INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES(?,?,?,'tessie',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_drive_id=excluded.provider_drive_id,legacy_drive_id=excluded.legacy_drive_id,started_at_utc=excluded.started_at_utc,ended_at_utc=excluded.ended_at_utc,started_at_epoch=excluded.started_at_epoch,ended_at_epoch=excluded.ended_at_epoch,starting_location=excluded.starting_location,ending_location=excluded.ending_location,starting_latitude=excluded.starting_latitude,starting_longitude=excluded.starting_longitude,ending_latitude=excluded.ending_latitude,ending_longitude=excluded.ending_longitude,starting_battery=excluded.starting_battery,ending_battery=excluded.ending_battery,distance_miles=excluded.distance_miles,energy_used_kwh=excluded.energy_used_kwh,average_speed_mph=excluded.average_speed_mph,max_speed_mph=excluded.max_speed_mph,tessie_tag=excluded.tessie_tag,driver_profile=excluded.driver_profile,raw_payload_json=excluded.raw_payload_json,source_updated_at_utc=excluded.source_updated_at_utc,updated_at_utc=excluded.updated_at_utc;"
            Args = @($Drive.id,$HouseholdId,$Vehicle.id,$Drive.providerDriveId,$Drive.legacyDriveId,$Drive.startedAtUtc,$Drive.endedAtUtc,$Drive.startedAtEpoch,$Drive.endedAtEpoch,$Drive.startingLocation,$Drive.endingLocation,$Drive.startingLatitude,$Drive.startingLongitude,$Drive.endingLatitude,$Drive.endingLongitude,$Drive.startingBattery,$Drive.endingBattery,$Drive.distanceMiles,$Drive.energyUsedKwh,$Drive.averageSpeedMph,$Drive.maxSpeedMph,$Drive.tessieTag,$Drive.driverProfile,$Drive.rawPayloadJson,$Drive.sourceUpdatedAtUtc,$Now,$Now)
        }
    }

    foreach ($Charge in @($Snapshot.charges)) {
        $RecordStatements += [PSCustomObject]@{
            Sql = "INSERT INTO charging_sessions(id,household_id,vehicle_id,provider,provider_session_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,location,latitude,longitude,is_supercharger,odometer_miles,energy_added_kwh,energy_used_kwh,miles_added,starting_battery,ending_battery,recorded_cost,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES(?,?,?,'tessie',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider_session_id=excluded.provider_session_id,started_at_utc=excluded.started_at_utc,ended_at_utc=excluded.ended_at_utc,started_at_epoch=excluded.started_at_epoch,ended_at_epoch=excluded.ended_at_epoch,location=excluded.location,latitude=excluded.latitude,longitude=excluded.longitude,is_supercharger=excluded.is_supercharger,odometer_miles=excluded.odometer_miles,energy_added_kwh=excluded.energy_added_kwh,energy_used_kwh=excluded.energy_used_kwh,miles_added=excluded.miles_added,starting_battery=excluded.starting_battery,ending_battery=excluded.ending_battery,recorded_cost=excluded.recorded_cost,raw_payload_json=excluded.raw_payload_json,source_updated_at_utc=excluded.source_updated_at_utc,updated_at_utc=excluded.updated_at_utc;"
            Args = @($Charge.id,$HouseholdId,$Vehicle.id,$Charge.providerSessionId,$Charge.startedAtUtc,$Charge.endedAtUtc,$Charge.startedAtEpoch,$Charge.endedAtEpoch,$Charge.location,$Charge.latitude,$Charge.longitude,$Charge.isSupercharger,$Charge.odometerMiles,$Charge.energyAddedKwh,$Charge.energyUsedKwh,$Charge.milesAdded,$Charge.startingBattery,$Charge.endingBattery,$Charge.recordedCost,$Charge.rawPayloadJson,$Charge.sourceUpdatedAtUtc,$Now,$Now)
        }
    }
    Invoke-DriveOSTursoStatementChunks -Repository $Repository -Statements $RecordStatements

    $CompletionStatements = @()
    foreach ($Resource in @($Snapshot.completedResources)) {
        $CompletionStatements += [PSCustomObject]@{
            Sql = "INSERT INTO integration_sync_cursors(household_id,provider,resource,cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error,updated_at_utc) VALUES(?,'tessie',?,?,?,?,?,NULL,?) ON CONFLICT(household_id,provider,resource) DO UPDATE SET cursor_value=excluded.cursor_value,high_watermark_utc=excluded.high_watermark_utc,last_attempt_at_utc=excluded.last_attempt_at_utc,last_success_at_utc=excluded.last_success_at_utc,last_error=NULL,updated_at_utc=excluded.updated_at_utc;"
            Args = @($HouseholdId,$Resource,$Snapshot.cursorEpoch,$Snapshot.rangeToUtc,$Now,$Now,$Now)
        }
    }
    if ($Snapshot.syncRun) { $CompletionStatements += New-DriveOSTursoSyncRunStatement -Run $Snapshot.syncRun }
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $CompletionStatements
}

function Set-DriveOSTursoIntegrationSyncRun {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Run)
    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    $ErrorValue = if ($Run.status -eq 'failed') { [string]$Run.errorMessage } else { $null }
    $Statements = @(
        [PSCustomObject]@{
            Sql = "INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"
            Args = @($Run.householdId,$Now,$Now)
        },
        (New-DriveOSTursoSyncRunStatement -Run $Run),
        [PSCustomObject]@{
            Sql = 'INSERT INTO integration_sync_cursors(household_id,provider,resource,cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error,updated_at_utc) VALUES(?,?,?,NULL,NULL,?,NULL,?,?) ON CONFLICT(household_id,provider,resource) DO UPDATE SET last_attempt_at_utc=excluded.last_attempt_at_utc,last_error=excluded.last_error,updated_at_utc=excluded.updated_at_utc;'
            Args = @($Run.householdId,$Run.provider,$Run.resource,$Run.startedAtUtc,$ErrorValue,$Now)
        }
    )
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $Statements
}

function Get-DriveOSTursoTessieDrives {
    param([Parameter(Mandatory=$true)]$Repository,[long]$FromEpoch)
    $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT raw_payload_json FROM drives WHERE provider IN ('tessie','google_timeline') AND started_at_epoch >= ? ORDER BY started_at_epoch DESC,id;" -Args @($FromEpoch))
    return @($Rows | ForEach-Object { $_.raw_payload_json | ConvertFrom-Json })
}

function Set-DriveOSTursoReconstructedDrives {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Batch)
    $Now=[string]$Batch.observedAtUtc
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements @(
        [PSCustomObject]@{ Sql="INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"; Args=@($Batch.householdId,$Now,$Now) },
        [PSCustomObject]@{ Sql="INSERT INTO vehicles(id,household_id,provider,provider_vehicle_id,vin,display_name,observed_at_utc,raw_payload_json,created_at_utc,updated_at_utc) VALUES(?,?,'google_timeline',?,NULL,?,?,'{`"source`":`"google_timeline`"}',?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,observed_at_utc=excluded.observed_at_utc,updated_at_utc=excluded.updated_at_utc;"; Args=@($Batch.vehicleId,$Batch.householdId,$Batch.providerVehicleId,$Batch.displayName,$Now,$Now,$Now) }
    )
    $Statements=@()
    foreach($Drive in @($Batch.records)){
        $Statements += [PSCustomObject]@{
            Sql="INSERT INTO drives(id,household_id,vehicle_id,provider,provider_drive_id,legacy_drive_id,started_at_utc,ended_at_utc,started_at_epoch,ended_at_epoch,starting_location,ending_location,starting_latitude,starting_longitude,ending_latitude,ending_longitude,starting_battery,ending_battery,distance_miles,energy_used_kwh,average_speed_mph,max_speed_mph,tessie_tag,driver_profile,raw_payload_json,source_updated_at_utc,created_at_utc,updated_at_utc) VALUES(?,?,?,'google_timeline',?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,NULL,NULL,NULL,'Reconstructed','Google Timeline',?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET raw_payload_json=excluded.raw_payload_json,distance_miles=excluded.distance_miles,updated_at_utc=excluded.updated_at_utc;"
            Args=@($Drive.id,$Batch.householdId,$Batch.vehicleId,$Drive.providerDriveId,$Drive.legacyDriveId,$Drive.startedAtUtc,$Drive.endedAtUtc,$Drive.startedAtEpoch,$Drive.endedAtEpoch,$Drive.startingLocation,$Drive.endingLocation,$Drive.startingLatitude,$Drive.startingLongitude,$Drive.endingLatitude,$Drive.endingLongitude,$Drive.distanceMiles,$Drive.rawPayloadJson,$Now,$Now)
        }
    }
    Invoke-DriveOSTursoStatementChunks -Repository $Repository -Statements $Statements
}

function Get-DriveOSTursoJourneyCollections {
    param([Parameter(Mandatory=$true)]$Repository,[string]$HouseholdId)
    $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT c.id,c.name,c.description,c.created_at_utc,c.updated_at_utc,d.legacy_drive_id,m.sort_order FROM journey_collections c LEFT JOIN journey_collection_drives m ON m.collection_id=c.id LEFT JOIN drives d ON d.id=m.drive_id WHERE c.household_id=? ORDER BY c.updated_at_utc DESC,c.id,m.sort_order,m.drive_id;' -Args @($HouseholdId))
    $Collections = @()
    foreach ($Group in @($Rows | Group-Object id)) {
        $First = $Group.Group[0]
        $Collections += [PSCustomObject]@{
            id=$First.id; name=$First.name; description=$First.description
            driveIds=@($Group.Group | Where-Object { $_.legacy_drive_id } | ForEach-Object { $_.legacy_drive_id })
            createdAtUtc=$First.created_at_utc; updatedAtUtc=$First.updated_at_utc
        }
    }
    return @($Collections)
}

function Set-DriveOSTursoJourneyCollection {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Collection,[string]$HouseholdId)
    $DriveIds = @($Collection.driveIds)
    $ExistingOwners = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT household_id FROM journey_collections WHERE id=?;' -Args @($Collection.id))
    if ($ExistingOwners.Count -and "$($ExistingOwners[0].household_id)" -ne $HouseholdId) { throw 'Collection belongs to another household.' }
    if ($DriveIds.Count) {
        $Placeholders = (@(1..$DriveIds.Count | ForEach-Object { '?' }) -join ',')
        $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT legacy_drive_id FROM drives WHERE household_id=? AND legacy_drive_id IN ($Placeholders);" -Args (@($HouseholdId) + $DriveIds))
        if ($Rows.Count -ne $DriveIds.Count) { throw 'One or more collection drives no longer exist.' }
    }
    $Now = [string]$Collection.updatedAtUtc
    $Statements = @(
        [PSCustomObject]@{ Sql="INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"; Args=@($HouseholdId,$Now,$Now) },
        [PSCustomObject]@{ Sql='INSERT INTO journey_collections(id,household_id,name,description,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,updated_at_utc=excluded.updated_at_utc WHERE journey_collections.household_id=excluded.household_id;'; Args=@($Collection.id,$HouseholdId,$Collection.name,$Collection.description,$Collection.createdAtUtc,$Now) },
        [PSCustomObject]@{ Sql='DELETE FROM journey_collection_drives WHERE collection_id=? AND EXISTS(SELECT 1 FROM journey_collections WHERE id=? AND household_id=?);'; Args=@($Collection.id,$Collection.id,$HouseholdId) }
    )
    for ($Index=0; $Index -lt $DriveIds.Count; $Index++) {
        $Statements += [PSCustomObject]@{ Sql='INSERT INTO journey_collection_drives(collection_id,drive_id,sort_order,added_at_utc) SELECT ?,id,?,? FROM drives WHERE household_id=? AND legacy_drive_id=?;'; Args=@($Collection.id,$Index,$Now,$HouseholdId,$DriveIds[$Index]) }
    }
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $Statements
}

function Remove-DriveOSTursoJourneyCollection {
    param([Parameter(Mandatory=$true)]$Repository,[string]$CollectionId,[string]$HouseholdId)
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements @([PSCustomObject]@{ Sql='DELETE FROM journey_collections WHERE id=? AND household_id=?;'; Args=@($CollectionId,$HouseholdId) })
}

function Get-DriveOSTursoJourneyAttachments {
    param($Repository,[string]$CollectionId,[string]$HouseholdId,[string]$AttachmentId,[switch]$IncludeData)
    $Fields=if($IncludeData){'id,collection_id,file_name,content_type,byte_length,data_base64,created_at_utc'}else{'id,collection_id,file_name,content_type,byte_length,created_at_utc'}
    if($AttachmentId){$Rows=@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT $Fields FROM journey_attachments WHERE id=? AND household_id=? LIMIT 1;" -Args @($AttachmentId,$HouseholdId))}
    else{$Rows=@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT $Fields FROM journey_attachments WHERE collection_id=? AND household_id=? ORDER BY created_at_utc,id;" -Args @($CollectionId,$HouseholdId))}
    return @($Rows|ForEach-Object{[PSCustomObject]@{id=$_.id;collectionId=$_.collection_id;fileName=$_.file_name;contentType=$_.content_type;byteLength=[int]$_.byte_length;dataBase64=$(if($IncludeData){$_.data_base64}else{$null});createdAtUtc=$_.created_at_utc}})
}

function Set-DriveOSTursoJourneyAttachment {
    param($Repository,$Record,[string]$HouseholdId)
    Invoke-DriveOSTursoExecute -Repository $Repository -Sql 'INSERT INTO journey_attachments(id,household_id,collection_id,file_name,content_type,byte_length,data_base64,created_at_utc) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM journey_collections WHERE id=? AND household_id=?);' -Args @($Record.id,$HouseholdId,$Record.collectionId,$Record.fileName,$Record.contentType,$Record.byteLength,$Record.dataBase64,$Record.createdAtUtc,$Record.collectionId,$HouseholdId)
}

function Remove-DriveOSTursoJourneyAttachment {
    param($Repository,[string]$AttachmentId,[string]$HouseholdId)
    Invoke-DriveOSTursoExecute -Repository $Repository -Sql 'DELETE FROM journey_attachments WHERE id=? AND household_id=?;' -Args @($AttachmentId,$HouseholdId)
}

function Get-DriveOSTursoTessieCharges {
    param([Parameter(Mandatory=$true)]$Repository,[long]$FromEpoch)
    $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT raw_payload_json FROM charging_sessions WHERE provider='tessie' AND started_at_epoch >= ? ORDER BY started_at_epoch DESC,id;" -Args @($FromEpoch))
    return @($Rows | ForEach-Object { $_.raw_payload_json | ConvertFrom-Json })
}

function Get-DriveOSTursoTessieAuditRows {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,
        [Parameter(Mandatory=$true)][long]$FromEpoch,
        [Parameter(Mandatory=$true)][long]$ToEpoch,
        [string]$VehicleId
    )
    $Table = if ($Resource -eq 'drives') { 'drives' } else { 'charging_sessions' }
    if ($VehicleId) {
        return @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT * FROM $Table WHERE provider='tessie' AND vehicle_id=? AND started_at_epoch >= ? AND started_at_epoch <= ? ORDER BY started_at_epoch,id;" -Args @($VehicleId,$FromEpoch,$ToEpoch))
    }
    return @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT * FROM $Table WHERE provider='tessie' AND started_at_epoch >= ? AND started_at_epoch <= ? ORDER BY started_at_epoch,id;" -Args @($FromEpoch,$ToEpoch))
}

function Get-DriveOSTursoIntegrationSyncCursor {
    param([Parameter(Mandatory=$true)]$Repository,[string]$HouseholdId,[string]$Provider,[string]$Resource)
    $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT cursor_value,high_watermark_utc,last_attempt_at_utc,last_success_at_utc,last_error FROM integration_sync_cursors WHERE household_id=? AND provider=? AND resource=?;' -Args @($HouseholdId,$Provider,$Resource))
    if (-not $Rows.Count) { return $null }
    return $Rows[0]
}

function Set-DriveOSTursoIntegrityAuditRun {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Run)
    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    $Statements = @(
        [PSCustomObject]@{ Sql="INSERT INTO households(id,display_name,created_at_utc,updated_at_utc) VALUES(?,'Primary household',?,?) ON CONFLICT(id) DO UPDATE SET updated_at_utc=excluded.updated_at_utc;"; Args=@($Run.householdId,$Now,$Now) },
        [PSCustomObject]@{
            Sql='INSERT INTO integrity_audit_runs(id,household_id,audit_kind,status,ready_for_read_canary,range_from_utc,range_to_utc,generated_at_utc,completed_at_utc,report_json,created_at_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,ready_for_read_canary=excluded.ready_for_read_canary,range_from_utc=excluded.range_from_utc,range_to_utc=excluded.range_to_utc,generated_at_utc=excluded.generated_at_utc,completed_at_utc=excluded.completed_at_utc,report_json=excluded.report_json;'
            Args=@($Run.id,$Run.householdId,$Run.auditKind,$Run.status,$(if($Run.readyForReadCanary){1}else{0}),$Run.rangeFromUtc,$Run.rangeToUtc,$Run.generatedAtUtc,$Run.completedAtUtc,($Run.report | ConvertTo-Json -Depth 30 -Compress),$Now)
        }
    )
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $Statements
}

function Get-DriveOSTursoLatestIntegrityAuditRun {
    param([Parameter(Mandatory=$true)]$Repository,[string]$HouseholdId,[string]$AuditKind)
    $Rows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT id,audit_kind,status,ready_for_read_canary,range_from_utc,range_to_utc,generated_at_utc,completed_at_utc,report_json FROM integrity_audit_runs WHERE household_id=? AND audit_kind=? ORDER BY completed_at_utc DESC,id DESC LIMIT 1;' -Args @($HouseholdId,$AuditKind))
    if (-not $Rows.Count) { return $null }
    $Row = $Rows[0]
    return [PSCustomObject]@{ id=$Row.id; auditKind=$Row.audit_kind; status=$Row.status; readyForReadCanary=([int]$Row.ready_for_read_canary -eq 1); rangeFromUtc=$Row.range_from_utc; rangeToUtc=$Row.range_to_utc; generatedAtUtc=$Row.generated_at_utc; completedAtUtc=$Row.completed_at_utc; report=($Row.report_json | ConvertFrom-Json) }
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

function Get-DriveOSTursoSoundtracks {
    param([Parameter(Mandatory=$true)]$Repository)

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT payload_json FROM drive_soundtracks ORDER BY drive_ended_at DESC,drive_id;")

    return @($Rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Set-DriveOSTursoSoundtrack {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Record
    )

    $Payload = $Record | ConvertTo-Json -Depth 30 -Compress
    $UpdatedAt = [DateTimeOffset]::UtcNow.ToString("o")

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT INTO drive_soundtracks(drive_id,drive_started_at,drive_ended_at,status,payload_json,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(drive_id) DO UPDATE SET drive_started_at=excluded.drive_started_at,drive_ended_at=excluded.drive_ended_at,status=excluded.status,payload_json=excluded.payload_json,updated_at=excluded.updated_at;" `
        -Args @("$($Record.driveId)", "$($Record.startedAt)", "$($Record.endedAt)", "$($Record.status)", $Payload, $UpdatedAt)
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

    $Statements = @([PSCustomObject]@{ Sql = "DELETE FROM place_aliases;" })

    foreach ($Entry in @($Entries)) {
        $Statements += [PSCustomObject]@{
            Sql = "INSERT INTO place_aliases(location,label) VALUES(?,?);"
            Args = @("$($Entry.location)", "$($Entry.label)")
        }
    }

    Invoke-DriveOSTursoTransactionalBatch `
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
    Get-DriveOSTursoHttpTimeoutSeconds, `
    Get-DriveOSTursoBatchStatementLimit, `
    Invoke-DriveOSTursoPipeline, `
    Invoke-DriveOSTursoTransactionalBatch, `
    Invoke-DriveOSTursoStatementChunks, `
    Invoke-DriveOSTursoQuery, `
    Invoke-DriveOSTursoExecute, `
    Initialize-DriveOSTurso, `
    Set-DriveOSTursoTessieSnapshot, `
    Set-DriveOSTursoIntegrationSyncRun, `
    Get-DriveOSTursoTessieDrives, `
    Set-DriveOSTursoReconstructedDrives, `
    Get-DriveOSTursoJourneyCollections, `
    Set-DriveOSTursoJourneyCollection, `
    Remove-DriveOSTursoJourneyCollection, `
    Get-DriveOSTursoJourneyAttachments, `
    Set-DriveOSTursoJourneyAttachment, `
    Remove-DriveOSTursoJourneyAttachment, `
    Get-DriveOSTursoTessieCharges, `
    Get-DriveOSTursoTessieAuditRows, `
    Get-DriveOSTursoIntegrationSyncCursor, `
    Set-DriveOSTursoIntegrityAuditRun, `
    Get-DriveOSTursoLatestIntegrityAuditRun, `
    Get-DriveOSTursoHistory, `
    Add-DriveOSTursoHistoryRecord, `
    Get-DriveOSTursoSoundtracks, `
    Set-DriveOSTursoSoundtrack, `
    Get-DriveOSTursoAliases, `
    Set-DriveOSTursoAliases, `
    Get-DriveOSTursoSettings, `
    Set-DriveOSTursoSettings, `
    Get-DriveOSTursoState, `
    Set-DriveOSTursoState, `
    Remove-DriveOSTursoState
