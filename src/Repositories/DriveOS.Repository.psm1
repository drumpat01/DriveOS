Set-StrictMode -Version 2.0

function Get-DriveOSRecordValue {
    param([AllowNull()]$Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function New-DriveOSStableDataId {
    param([Parameter(Mandatory=$true)][string]$Entity,[Parameter(Mandatory=$true)][string]$ProviderKey)
    $Sha = [Security.Cryptography.SHA256]::Create()
    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes("journeydeck`0$Entity`0$ProviderKey")
        $Hex = ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
        return "${Entity}_$($Hex.Substring(0,32))"
    }
    finally { $Sha.Dispose() }
}

function New-DriveOSTessieSnapshot {
    param(
        [Parameter(Mandatory=$true)]$Vehicle,
        [object[]]$Drives=@(),
        [object[]]$Charges=@(),
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [DateTimeOffset]$SyncedAtUtc=[DateTimeOffset]::UtcNow,
        [string]$HouseholdId='household_primary',
        [ValidateSet('drives','charges')][string[]]$CompletedResources=@('drives','charges'),
        [AllowNull()]$SyncRun=$null
    )

    $Vin = "$(Get-DriveOSRecordValue -Record $Vehicle -Name 'vin')".Trim()
    if (-not $Vin) { throw 'A Tessie VIN is required to persist history.' }
    $VehicleState = Get-DriveOSRecordValue -Record $Vehicle -Name 'last_state'
    $DisplayName = Get-DriveOSRecordValue -Record $VehicleState -Name 'display_name'
    $VehicleId = New-DriveOSStableDataId -Entity 'vehicle' -ProviderKey "tessie:$Vin"
    $SyncStamp = $SyncedAtUtc.ToUniversalTime().ToString('o')
    $DriveRows = @()
    $ChargeRows = @()

    foreach ($Drive in @($Drives)) {
        $Started = [long](Get-DriveOSRecordValue -Record $Drive -Name 'started_at')
        $Ended = [long](Get-DriveOSRecordValue -Record $Drive -Name 'ended_at')
        if ($Started -le 0 -or $Ended -lt $Started) { throw 'Tessie returned an invalid drive timeframe.' }
        $RawProviderId = "$(Get-DriveOSRecordValue -Record $Drive -Name 'id')".Trim()
        $ProviderId = if ($RawProviderId) { $RawProviderId } else { "${Vin}:${Started}:$Ended" }
        $DriveRows += [PSCustomObject]@{
            id = New-DriveOSStableDataId -Entity 'drive' -ProviderKey "tessie:${Vin}:$ProviderId"
            providerDriveId = $ProviderId
            legacyDriveId = "$Started-$Ended"
            startedAtUtc = [DateTimeOffset]::FromUnixTimeSeconds($Started).ToString('o')
            endedAtUtc = [DateTimeOffset]::FromUnixTimeSeconds($Ended).ToString('o')
            startedAtEpoch = $Started; endedAtEpoch = $Ended
            startingLocation = Get-DriveOSRecordValue $Drive 'starting_location'
            endingLocation = Get-DriveOSRecordValue $Drive 'ending_location'
            startingLatitude = Get-DriveOSRecordValue $Drive 'starting_latitude'
            startingLongitude = Get-DriveOSRecordValue $Drive 'starting_longitude'
            endingLatitude = Get-DriveOSRecordValue $Drive 'ending_latitude'
            endingLongitude = Get-DriveOSRecordValue $Drive 'ending_longitude'
            startingBattery = Get-DriveOSRecordValue $Drive 'starting_battery'
            endingBattery = Get-DriveOSRecordValue $Drive 'ending_battery'
            distanceMiles = Get-DriveOSRecordValue $Drive 'odometer_distance'
            energyUsedKwh = Get-DriveOSRecordValue $Drive 'energy_used'
            averageSpeedMph = Get-DriveOSRecordValue $Drive 'average_speed'
            maxSpeedMph = Get-DriveOSRecordValue $Drive 'max_speed'
            tessieTag = Get-DriveOSRecordValue $Drive 'tag'
            driverProfile = Get-DriveOSRecordValue $Drive 'driver_profile'
            rawPayloadJson = $Drive | ConvertTo-Json -Depth 50 -Compress
            sourceUpdatedAtUtc = $null
        }
    }

    foreach ($Charge in @($Charges)) {
        $Started = [long](Get-DriveOSRecordValue -Record $Charge -Name 'started_at')
        $Ended = [long](Get-DriveOSRecordValue -Record $Charge -Name 'ended_at')
        if ($Started -le 0 -or $Ended -lt $Started) { throw 'Tessie returned an invalid charging-session timeframe.' }
        $RawProviderId = "$(Get-DriveOSRecordValue -Record $Charge -Name 'id')".Trim()
        $ProviderId = if ($RawProviderId) { $RawProviderId } else { "${Vin}:${Started}:$Ended" }
        $ChargeRows += [PSCustomObject]@{
            id = New-DriveOSStableDataId -Entity 'charge' -ProviderKey "tessie:${Vin}:$ProviderId"
            providerSessionId = $ProviderId
            startedAtUtc = [DateTimeOffset]::FromUnixTimeSeconds($Started).ToString('o')
            endedAtUtc = [DateTimeOffset]::FromUnixTimeSeconds($Ended).ToString('o')
            startedAtEpoch = $Started; endedAtEpoch = $Ended
            location = Get-DriveOSRecordValue $Charge 'location'
            latitude = Get-DriveOSRecordValue $Charge 'latitude'
            longitude = Get-DriveOSRecordValue $Charge 'longitude'
            isSupercharger = if ([bool](Get-DriveOSRecordValue $Charge 'is_supercharger')) { 1 } else { 0 }
            odometerMiles = Get-DriveOSRecordValue $Charge 'odometer'
            energyAddedKwh = Get-DriveOSRecordValue $Charge 'energy_added'
            energyUsedKwh = Get-DriveOSRecordValue $Charge 'energy_used'
            milesAdded = Get-DriveOSRecordValue $Charge 'miles_added'
            startingBattery = Get-DriveOSRecordValue $Charge 'starting_battery'
            endingBattery = Get-DriveOSRecordValue $Charge 'ending_battery'
            recordedCost = Get-DriveOSRecordValue $Charge 'cost'
            rawPayloadJson = $Charge | ConvertTo-Json -Depth 50 -Compress
            sourceUpdatedAtUtc = $null
        }
    }

    return [PSCustomObject]@{
        householdId = $HouseholdId
        syncedAtUtc = $SyncStamp
        rangeToUtc = $RangeToUtc.ToUniversalTime().ToString('o')
        cursorEpoch = $RangeToUtc.ToUnixTimeSeconds()
        completedResources = @($CompletedResources)
        syncRun = $SyncRun
        vehicle = [PSCustomObject]@{
            id = $VehicleId; providerVehicleId = $Vin; vin = $Vin; displayName = $DisplayName
            observedAtUtc = $SyncStamp; rawPayloadJson = $Vehicle | ConvertTo-Json -Depth 50 -Compress
        }
        drives = @($DriveRows)
        charges = @($ChargeRows)
    }
}

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
        if ($PSVersionTable.PSEdition -eq 'Desktop' -or $env:OS -eq 'Windows_NT') {
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
        DriveSoundtracksPath = Join-Path $DataDirectory 'drive-soundtracks.json'
        PlaceAliasesPath = Join-Path $DataDirectory 'place-aliases.json'
        ChargingSettingsPath = Join-Path $DataDirectory 'charging-settings.json'
        DashboardLayoutPath = Join-Path $DataDirectory 'dashboard-layout.json'
        IntegrationHealthPath = Join-Path $DataDirectory 'integration-health.json'
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

function Save-DriveOSTessieHistorySnapshot {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Vehicle,
        [object[]]$Drives=@(),
        [object[]]$Charges=@(),
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [DateTimeOffset]$SyncedAtUtc=[DateTimeOffset]::UtcNow,
        [string]$HouseholdId='household_primary',
        [ValidateSet('drives','charges')][string[]]$CompletedResources=@('drives','charges'),
        [AllowNull()]$SyncRun=$null
    )

    if ($Repository.Provider -eq 'Json') {
        return [PSCustomObject]@{ persisted=$false; drives=0; charges=0; reason='JSON compatibility provider' }
    }
    $Snapshot = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives $Drives -Charges $Charges -RangeToUtc $RangeToUtc -SyncedAtUtc $SyncedAtUtc -HouseholdId $HouseholdId -CompletedResources $CompletedResources -SyncRun $SyncRun

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteTessieSnapshot -Repository $Repository -Snapshot $Snapshot
    }
    elseif ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoTessieSnapshot -Repository $Repository -Snapshot $Snapshot
    }
    else { throw 'Tessie history persistence requires SQLite or Turso.' }

    return [PSCustomObject]@{ persisted=$true; drives=@($Snapshot.drives).Count; charges=@($Snapshot.charges).Count; cursorEpoch=$Snapshot.cursorEpoch }
}

function New-DriveOSIntegrationSyncRun {
    param(
        [Parameter(Mandatory=$true)][string]$Provider,
        [Parameter(Mandatory=$true)][string]$Resource,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFromUtc,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [DateTimeOffset]$StartedAtUtc=[DateTimeOffset]::UtcNow,
        [string]$HouseholdId='household_primary'
    )
    $IdempotencyKey = "$Provider`:$Resource`:$($RangeFromUtc.ToUnixTimeSeconds())`:$($RangeToUtc.ToUnixTimeSeconds())"
    return [PSCustomObject]@{
        id = New-DriveOSStableDataId -Entity 'sync_run' -ProviderKey "$HouseholdId`:$IdempotencyKey"
        householdId = $HouseholdId
        provider = $Provider
        resource = $Resource
        idempotencyKey = $IdempotencyKey
        status = 'running'
        rangeFromUtc = $RangeFromUtc.ToUniversalTime().ToString('o')
        rangeToUtc = $RangeToUtc.ToUniversalTime().ToString('o')
        recordsSeen = 0
        recordsWritten = 0
        startedAtUtc = $StartedAtUtc.ToUniversalTime().ToString('o')
        completedAtUtc = $null
        errorMessage = $null
    }
}

function Set-DriveOSIntegrationSyncRun {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Run)
    if ($Repository.Provider -eq 'SQLite') { Set-DriveOSSqliteIntegrationSyncRun -Repository $Repository -Run $Run; return }
    if ($Repository.Provider -eq 'Turso') { Set-DriveOSTursoIntegrationSyncRun -Repository $Repository -Run $Run; return }
    if ($Repository.Provider -eq 'Json') { return }
    throw 'Integration sync run persistence requires SQLite or Turso.'
}

function Get-DriveOSTessieDrives {
    param([Parameter(Mandatory=$true)]$Repository,[ValidateRange(1,730)][int]$Days=365)
    $FromEpoch = [DateTimeOffset]::UtcNow.AddDays(-$Days).ToUnixTimeSeconds()
    if ($Repository.Provider -eq 'SQLite') { return @(Get-DriveOSSqliteTessieDrives -Repository $Repository -FromEpoch $FromEpoch) }
    if ($Repository.Provider -eq 'Turso') { return @(Get-DriveOSTursoTessieDrives -Repository $Repository -FromEpoch $FromEpoch) }
    throw 'Durable Tessie history reads require SQLite or Turso.'
}

function Get-DriveOSTessieCharges {
    param([Parameter(Mandatory=$true)]$Repository,[ValidateRange(1,730)][int]$Days=365)
    $FromEpoch = [DateTimeOffset]::UtcNow.AddDays(-$Days).ToUnixTimeSeconds()
    if ($Repository.Provider -eq 'SQLite') { return @(Get-DriveOSSqliteTessieCharges -Repository $Repository -FromEpoch $FromEpoch) }
    if ($Repository.Provider -eq 'Turso') { return @(Get-DriveOSTursoTessieCharges -Repository $Repository -FromEpoch $FromEpoch) }
    throw 'Durable Tessie history reads require SQLite or Turso.'
}

function Get-DriveOSIntegrationSyncCursor {
    param([Parameter(Mandatory=$true)]$Repository,[string]$Provider,[string]$Resource,[string]$HouseholdId='household_primary')
    if ($Repository.Provider -eq 'SQLite') { return Get-DriveOSSqliteIntegrationSyncCursor -Repository $Repository -HouseholdId $HouseholdId -Provider $Provider -Resource $Resource }
    if ($Repository.Provider -eq 'Turso') { return Get-DriveOSTursoIntegrationSyncCursor -Repository $Repository -HouseholdId $HouseholdId -Provider $Provider -Resource $Resource }
    return $null
}

function Get-DriveOSTessieAuditRows {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,
        [Parameter(Mandatory=$true)][long]$FromEpoch,
        [Parameter(Mandatory=$true)][long]$ToEpoch,
        [string]$VehicleId
    )
    if ($Repository.Provider -eq 'SQLite') { return @(Get-DriveOSSqliteTessieAuditRows -Repository $Repository -Resource $Resource -FromEpoch $FromEpoch -ToEpoch $ToEpoch -VehicleId $VehicleId) }
    if ($Repository.Provider -eq 'Turso') { return @(Get-DriveOSTursoTessieAuditRows -Repository $Repository -Resource $Resource -FromEpoch $FromEpoch -ToEpoch $ToEpoch -VehicleId $VehicleId) }
    throw 'Tessie parity audit requires SQLite or Turso.'
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

function Get-DriveOSDriveSoundtracks {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteSoundtracks -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoSoundtracks -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.DriveSoundtracksPath -Default @())
}

function Set-DriveOSDriveSoundtrack {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Record)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteSoundtrack -Repository $Repository -Record $Record
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoSoundtrack -Repository $Repository -Record $Record
        return
    }

    Assert-JsonRepository $Repository
    $Records = @(Read-DriveOSJson -Path $Repository.DriveSoundtracksPath -Default @() | Where-Object { "$($_.driveId)" -ne "$($Record.driveId)" })
    Write-DriveOSJson -Path $Repository.DriveSoundtracksPath -Value @($Records + $Record)
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

function Get-DriveOSDashboardLayoutRecord {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return Get-DriveOSSqliteDashboardLayout -Repository $Repository
    }

    if ($Repository.Provider -eq 'Turso') {
        return Get-DriveOSTursoState -Repository $Repository -Key 'dashboard-layout'
    }

    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.DashboardLayoutPath
}

function Set-DriveOSDashboardLayoutRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$LayoutRecord)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteDashboardLayout -Repository $Repository -LayoutRecord $LayoutRecord
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoState -Repository $Repository -Key 'dashboard-layout' -Value $LayoutRecord
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.DashboardLayoutPath -Value $LayoutRecord
}

function Get-DriveOSIntegrationHealthRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)][string]$Provider)
    $Key = "integration-health:$Provider"
    if ($Repository.Provider -eq 'SQLite') { return Get-DriveOSSqliteState -Repository $Repository -Key $Key }
    if ($Repository.Provider -eq 'Turso') { return Get-DriveOSTursoState -Repository $Repository -Key $Key }
    Assert-JsonRepository $Repository
    $Records = Read-DriveOSJson -Path $Repository.IntegrationHealthPath -Default @{}
    if ($Records -and $Records.PSObject.Properties[$Provider]) { return $Records.$Provider }
    return $null
}

function Set-DriveOSIntegrationHealthRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)][string]$Provider,[Parameter(Mandatory=$true)]$Record)
    $Key = "integration-health:$Provider"
    if ($Repository.Provider -eq 'SQLite') { Set-DriveOSSqliteState -Repository $Repository -Key $Key -Value $Record; return }
    if ($Repository.Provider -eq 'Turso') { Set-DriveOSTursoState -Repository $Repository -Key $Key -Value $Record; return }
    Assert-JsonRepository $Repository
    $Records = Read-DriveOSJson -Path $Repository.IntegrationHealthPath -Default @{}
    if (-not $Records) { $Records = [PSCustomObject]@{} }
    $Records | Add-Member -NotePropertyName $Provider -NotePropertyValue $Record -Force
    Write-DriveOSJson -Path $Repository.IntegrationHealthPath -Value $Records
}

function Assert-JsonRepository {
    param($Repository)

    if (-not $Repository -or $Repository.Provider -ne 'Json') {
        throw 'The configured DriveOS repository provider is not supported by this build.'
    }
}

Export-ModuleMember -Function `
    New-DriveOSRepository, `
    New-DriveOSStableDataId, `
    New-DriveOSTessieSnapshot, `
    Save-DriveOSTessieHistorySnapshot, `
    New-DriveOSIntegrationSyncRun, `
    Set-DriveOSIntegrationSyncRun, `
    Get-DriveOSTessieDrives, `
    Get-DriveOSTessieCharges, `
    Get-DriveOSIntegrationSyncCursor, `
    Get-DriveOSTessieAuditRows, `
    Get-DriveOSListeningHistory, `
    Add-DriveOSListeningHistoryRecord, `
    Get-DriveOSDriveSoundtracks, `
    Set-DriveOSDriveSoundtrack, `
    Get-DriveOSPlaceAliases, `
    Set-DriveOSPlaceAliases, `
    Get-DriveOSChargingSettingsRecord, `
    Set-DriveOSChargingSettingsRecord, `
    Get-DriveOSDashboardLayoutRecord, `
    Set-DriveOSDashboardLayoutRecord, `
    Get-DriveOSIntegrationHealthRecord, `
    Set-DriveOSIntegrationHealthRecord
