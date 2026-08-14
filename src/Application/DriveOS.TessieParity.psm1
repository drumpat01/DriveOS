Set-StrictMode -Version 2.0

function Get-JourneyDeckRecordValue {
    param([AllowNull()]$Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function ConvertTo-JourneyDeckCanonicalValue {
    param([AllowNull()]$Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [string] -or $Value -is [char] -or $Value -is [bool] -or $Value.GetType().IsPrimitive -or $Value -is [decimal]) {
        return $Value
    }
    if ($Value -is [Collections.IDictionary]) {
        $Ordered = [ordered]@{}
        foreach ($Key in @($Value.Keys | Sort-Object { "$_" })) {
            $Ordered["$Key"] = ConvertTo-JourneyDeckCanonicalValue -Value $Value[$Key]
        }
        return $Ordered
    }
    if ($Value -is [Collections.IEnumerable]) {
        $Items = @($Value | ForEach-Object { ConvertTo-JourneyDeckCanonicalValue -Value $_ })
        return ,$Items
    }
    $Object = [ordered]@{}
    foreach ($Property in @($Value.PSObject.Properties | Sort-Object Name)) {
        $Object[$Property.Name] = ConvertTo-JourneyDeckCanonicalValue -Value $Property.Value
    }
    return $Object
}

function Get-JourneyDeckPayloadHash {
    param([AllowNull()]$Value)
    $Canonical = ConvertTo-JourneyDeckCanonicalValue -Value $Value
    $Json = $Canonical | ConvertTo-Json -Depth 50 -Compress
    $Sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($Sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Json)))).Replace('-','').ToLowerInvariant()
    }
    finally { $Sha.Dispose() }
}

function Test-JourneyDeckScalarEqual {
    param([AllowNull()]$Left,[AllowNull()]$Right)
    if ($null -eq $Left -and $null -eq $Right) { return $true }
    if ($null -eq $Left -or $null -eq $Right) { return $false }
    $NumericTypes = @([byte],[sbyte],[int16],[uint16],[int32],[uint32],[int64],[uint64],[single],[double],[decimal])
    if ($Left.GetType() -in $NumericTypes -and $Right.GetType() -in $NumericTypes) {
        return [decimal]$Left -eq [decimal]$Right
    }
    return "$Left" -ceq "$Right"
}

function Get-JourneyDeckProviderIdentity {
    param([Parameter(Mandatory=$true)]$Record,[Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,[Parameter(Mandatory=$true)][string]$Vin)
    $Started = [long](Get-JourneyDeckRecordValue $Record 'started_at')
    $Ended = [long](Get-JourneyDeckRecordValue $Record 'ended_at')
    if ($Resource -eq 'drives') { return "$Started-$Ended" }
    $ProviderId = "$(Get-JourneyDeckRecordValue $Record 'id')".Trim()
    if ($ProviderId) { return $ProviderId }
    return "${Vin}:${Started}:$Ended"
}

function Get-JourneyDeckDatabaseIdentity {
    param([Parameter(Mandatory=$true)]$Row,[Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource)
    if ($Resource -eq 'drives') { return "$(Get-JourneyDeckRecordValue $Row 'legacy_drive_id')" }
    return "$(Get-JourneyDeckRecordValue $Row 'provider_session_id')"
}

function Get-JourneyDeckExpectedNormalizedValues {
    param([Parameter(Mandatory=$true)]$Record,[Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,[Parameter(Mandatory=$true)][string]$Vin)
    $Started = [long](Get-JourneyDeckRecordValue $Record 'started_at')
    $Ended = [long](Get-JourneyDeckRecordValue $Record 'ended_at')
    if ($Resource -eq 'drives') {
        $RawProviderId = "$(Get-JourneyDeckRecordValue $Record 'id')".Trim()
        $ProviderId = if ($RawProviderId) { $RawProviderId } else { "${Vin}:${Started}:$Ended" }
        return [ordered]@{
            id = New-DriveOSStableDataId -Entity drive -ProviderKey "tessie:${Vin}:$ProviderId"
            provider_drive_id = $ProviderId
            legacy_drive_id = "$Started-$Ended"
            started_at_utc = [DateTimeOffset]::FromUnixTimeSeconds($Started).ToString('o')
            ended_at_utc = [DateTimeOffset]::FromUnixTimeSeconds($Ended).ToString('o')
            started_at_epoch = $Started
            ended_at_epoch = $Ended
            starting_location = Get-JourneyDeckRecordValue $Record 'starting_location'
            ending_location = Get-JourneyDeckRecordValue $Record 'ending_location'
            starting_latitude = Get-JourneyDeckRecordValue $Record 'starting_latitude'
            starting_longitude = Get-JourneyDeckRecordValue $Record 'starting_longitude'
            ending_latitude = Get-JourneyDeckRecordValue $Record 'ending_latitude'
            ending_longitude = Get-JourneyDeckRecordValue $Record 'ending_longitude'
            starting_battery = Get-JourneyDeckRecordValue $Record 'starting_battery'
            ending_battery = Get-JourneyDeckRecordValue $Record 'ending_battery'
            distance_miles = Get-JourneyDeckRecordValue $Record 'odometer_distance'
            energy_used_kwh = Get-JourneyDeckRecordValue $Record 'energy_used'
            average_speed_mph = Get-JourneyDeckRecordValue $Record 'average_speed'
            max_speed_mph = Get-JourneyDeckRecordValue $Record 'max_speed'
            tessie_tag = Get-JourneyDeckRecordValue $Record 'tag'
            driver_profile = Get-JourneyDeckRecordValue $Record 'driver_profile'
        }
    }
    $ProviderSessionId = Get-JourneyDeckProviderIdentity -Record $Record -Resource charges -Vin $Vin
    return [ordered]@{
        id = New-DriveOSStableDataId -Entity charge -ProviderKey "tessie:${Vin}:$ProviderSessionId"
        provider_session_id = $ProviderSessionId
        started_at_utc = [DateTimeOffset]::FromUnixTimeSeconds($Started).ToString('o')
        ended_at_utc = [DateTimeOffset]::FromUnixTimeSeconds($Ended).ToString('o')
        started_at_epoch = $Started
        ended_at_epoch = $Ended
        location = Get-JourneyDeckRecordValue $Record 'location'
        latitude = Get-JourneyDeckRecordValue $Record 'latitude'
        longitude = Get-JourneyDeckRecordValue $Record 'longitude'
        is_supercharger = if ([bool](Get-JourneyDeckRecordValue $Record 'is_supercharger')) { 1 } else { 0 }
        odometer_miles = Get-JourneyDeckRecordValue $Record 'odometer'
        energy_added_kwh = Get-JourneyDeckRecordValue $Record 'energy_added'
        energy_used_kwh = Get-JourneyDeckRecordValue $Record 'energy_used'
        miles_added = Get-JourneyDeckRecordValue $Record 'miles_added'
        starting_battery = Get-JourneyDeckRecordValue $Record 'starting_battery'
        ending_battery = Get-JourneyDeckRecordValue $Record 'ending_battery'
        recorded_cost = Get-JourneyDeckRecordValue $Record 'cost'
    }
}

function Get-JourneyDeckCountsByUtcDay {
    param([object[]]$Records=@(),[Parameter(Mandatory=$true)][string]$EpochProperty)
    $Counts = [ordered]@{}
    foreach ($Record in @($Records)) {
        $Epoch = [long](Get-JourneyDeckRecordValue $Record $EpochProperty)
        $Day = [DateTimeOffset]::FromUnixTimeSeconds($Epoch).UtcDateTime.ToString('yyyy-MM-dd')
        if (-not $Counts.Contains($Day)) { $Counts[$Day] = 0 }
        $Counts[$Day]++
    }
    return $Counts
}

function Get-JourneyDeckCompatibilityProjection {
    param([Parameter(Mandatory=$true)]$Record,[Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource)
    if ($Resource -eq 'drives') {
        return ConvertTo-DriveOSDrive -Drive $Record -Soundtrack @() -StartingLocation "$(Get-JourneyDeckRecordValue $Record 'starting_location')" -EndingLocation "$(Get-JourneyDeckRecordValue $Record 'ending_location')"
    }
    return ConvertTo-DriveOSCharge -Charge $Record -Settings $null -FriendlyLocation "$(Get-JourneyDeckRecordValue $Record 'location')"
}

function Compare-JourneyDeckTessieResource {
    param(
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,
        [object[]]$ProviderRecords=@(),
        [object[]]$DatabaseRows=@(),
        [Parameter(Mandatory=$true)][string]$Vin
    )
    $ProviderMap = @{}
    $DatabaseMap = @{}
    $ProviderDuplicates = @()
    $DatabaseDuplicates = @()
    foreach ($Record in @($ProviderRecords)) {
        $Identity = Get-JourneyDeckProviderIdentity -Record $Record -Resource $Resource -Vin $Vin
        if ($ProviderMap.ContainsKey($Identity)) { $ProviderDuplicates += $Identity }
        $ProviderMap[$Identity] = $Record
    }
    foreach ($Row in @($DatabaseRows)) {
        $Identity = Get-JourneyDeckDatabaseIdentity -Row $Row -Resource $Resource
        if ($DatabaseMap.ContainsKey($Identity)) { $DatabaseDuplicates += $Identity }
        $DatabaseMap[$Identity] = $Row
    }
    $Missing = @($ProviderMap.Keys | Where-Object { -not $DatabaseMap.ContainsKey($_) } | Sort-Object)
    $Unexpected = @($DatabaseMap.Keys | Where-Object { -not $ProviderMap.ContainsKey($_) } | Sort-Object)
    $PayloadMismatches = @()
    $ProjectionMismatches = @()
    $NormalizedMismatches = @()
    foreach ($Identity in @($ProviderMap.Keys | Where-Object { $DatabaseMap.ContainsKey($_) })) {
        $ProviderRecord = $ProviderMap[$Identity]
        $DatabaseRow = $DatabaseMap[$Identity]
        $RawJson = "$(Get-JourneyDeckRecordValue $DatabaseRow 'raw_payload_json')"
        try { $DatabasePayload = $RawJson | ConvertFrom-Json }
        catch { $DatabasePayload = $null }
        if ($null -eq $DatabasePayload -or (Get-JourneyDeckPayloadHash $ProviderRecord) -ne (Get-JourneyDeckPayloadHash $DatabasePayload)) {
            $PayloadMismatches += $Identity
        }
        if ($null -eq $DatabasePayload -or (Get-JourneyDeckPayloadHash (Get-JourneyDeckCompatibilityProjection -Record $ProviderRecord -Resource $Resource)) -ne (Get-JourneyDeckPayloadHash (Get-JourneyDeckCompatibilityProjection -Record $DatabasePayload -Resource $Resource))) {
            $ProjectionMismatches += $Identity
        }
        $Expected = Get-JourneyDeckExpectedNormalizedValues -Record $ProviderRecord -Resource $Resource -Vin $Vin
        $Fields = @()
        foreach ($Field in $Expected.Keys) {
            if (-not (Test-JourneyDeckScalarEqual -Left $Expected[$Field] -Right (Get-JourneyDeckRecordValue $DatabaseRow $Field))) { $Fields += $Field }
        }
        if ($Fields.Count) { $NormalizedMismatches += [PSCustomObject]@{ identity=$Identity; fields=@($Fields) } }
    }
    $ProviderDays = Get-JourneyDeckCountsByUtcDay -Records $ProviderRecords -EpochProperty 'started_at'
    $DatabaseDays = Get-JourneyDeckCountsByUtcDay -Records $DatabaseRows -EpochProperty 'started_at_epoch'
    $DayParity = (Get-JourneyDeckPayloadHash $ProviderDays) -eq (Get-JourneyDeckPayloadHash $DatabaseDays)
    $ProviderEpochs = @($ProviderRecords | ForEach-Object { [long](Get-JourneyDeckRecordValue $_ 'started_at') })
    $DatabaseEpochs = @($DatabaseRows | ForEach-Object { [long](Get-JourneyDeckRecordValue $_ 'started_at_epoch') })
    $ProviderOldest = if ($ProviderEpochs.Count) { ($ProviderEpochs | Measure-Object -Minimum).Minimum } else { $null }
    $ProviderNewest = if ($ProviderEpochs.Count) { ($ProviderEpochs | Measure-Object -Maximum).Maximum } else { $null }
    $DatabaseOldest = if ($DatabaseEpochs.Count) { ($DatabaseEpochs | Measure-Object -Minimum).Minimum } else { $null }
    $DatabaseNewest = if ($DatabaseEpochs.Count) { ($DatabaseEpochs | Measure-Object -Maximum).Maximum } else { $null }
    $Passed = $ProviderDuplicates.Count -eq 0 -and $DatabaseDuplicates.Count -eq 0 -and $Missing.Count -eq 0 -and $Unexpected.Count -eq 0 -and $PayloadMismatches.Count -eq 0 -and $ProjectionMismatches.Count -eq 0 -and $NormalizedMismatches.Count -eq 0 -and $DayParity -and (Test-JourneyDeckScalarEqual $ProviderOldest $DatabaseOldest) -and (Test-JourneyDeckScalarEqual $ProviderNewest $DatabaseNewest)
    return [PSCustomObject]@{
        resource = $Resource
        passed = $Passed
        providerCount = @($ProviderRecords).Count
        databaseCount = @($DatabaseRows).Count
        providerCountsByUtcDay = $ProviderDays
        databaseCountsByUtcDay = $DatabaseDays
        dayCountParity = $DayParity
        providerOldestEpoch = $ProviderOldest
        databaseOldestEpoch = $DatabaseOldest
        providerNewestEpoch = $ProviderNewest
        databaseNewestEpoch = $DatabaseNewest
        providerDuplicateCount = $ProviderDuplicates.Count
        databaseDuplicateCount = $DatabaseDuplicates.Count
        missingFromDatabaseCount = $Missing.Count
        unexpectedInDatabaseCount = $Unexpected.Count
        payloadMismatchCount = $PayloadMismatches.Count
        compatibilityProjectionMismatchCount = $ProjectionMismatches.Count
        normalizedMismatchCount = $NormalizedMismatches.Count
        examples = [PSCustomObject]@{
            providerDuplicates = @($ProviderDuplicates | Select-Object -First 10)
            databaseDuplicates = @($DatabaseDuplicates | Select-Object -First 10)
            missingFromDatabase = @($Missing | Select-Object -First 10)
            unexpectedInDatabase = @($Unexpected | Select-Object -First 10)
            payloadMismatches = @($PayloadMismatches | Select-Object -First 10)
            compatibilityProjectionMismatches = @($ProjectionMismatches | Select-Object -First 10)
            normalizedMismatches = @($NormalizedMismatches | Select-Object -First 10)
        }
    }
}

function New-JourneyDeckTessieParityReport {
    param(
        [Parameter(Mandatory=$true)][string]$RepositoryProvider,
        [Parameter(Mandatory=$true)][string]$Vin,
        [object[]]$ProviderDrives=@(),
        [object[]]$DatabaseDrives=@(),
        [object[]]$ProviderCharges=@(),
        [object[]]$DatabaseCharges=@(),
        [Parameter(Mandatory=$true)][AllowNull()]$DriveCursor,
        [Parameter(Mandatory=$true)][AllowNull()]$ChargeCursor,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFromUtc,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [DateTimeOffset]$GeneratedAtUtc=[DateTimeOffset]::UtcNow,
        [ValidateRange(1,1440)][int]$MaximumCursorLagMinutes=45
    )
    $DriveParity = Compare-JourneyDeckTessieResource -Resource drives -ProviderRecords $ProviderDrives -DatabaseRows $DatabaseDrives -Vin $Vin
    $ChargeParity = Compare-JourneyDeckTessieResource -Resource charges -ProviderRecords $ProviderCharges -DatabaseRows $DatabaseCharges -Vin $Vin
    $CursorResults = @()
    $CursorIncomplete = $false
    foreach ($Entry in @([PSCustomObject]@{ resource='drives'; cursor=$DriveCursor },[PSCustomObject]@{ resource='charges'; cursor=$ChargeCursor })) {
        $Epoch = 0L
        $Value = "$(Get-JourneyDeckRecordValue $Entry.cursor 'cursor_value')"
        $Valid = [long]::TryParse($Value,[ref]$Epoch) -and $Epoch -ge $RangeToUtc.ToUnixTimeSeconds()
        $Lag = if ($Epoch -gt 0) { [math]::Round(($GeneratedAtUtc - [DateTimeOffset]::FromUnixTimeSeconds($Epoch)).TotalMinutes,1) } else { $null }
        $LastError = Get-JourneyDeckRecordValue $Entry.cursor 'last_error'
        $LastSuccess = Get-JourneyDeckRecordValue $Entry.cursor 'last_success_at_utc'
        if ($null -eq $Entry.cursor -or -not $Valid -or [String]::IsNullOrWhiteSpace("$LastSuccess")) { $CursorIncomplete = $true }
        $Passed = $Valid -and $null -ne $Lag -and $Lag -ge -5 -and $Lag -le $MaximumCursorLagMinutes -and [String]::IsNullOrWhiteSpace("$LastError") -and -not [String]::IsNullOrWhiteSpace("$LastSuccess")
        $CursorResults += [PSCustomObject]@{ resource=$Entry.resource; passed=$Passed; cursorEpoch=if($Epoch -gt 0){$Epoch}else{$null}; lagMinutes=$Lag; lastSuccessAtUtc=$LastSuccess; lastError=$LastError }
    }
    $CursorPassed = @($CursorResults | Where-Object { -not $_.passed }).Count -eq 0
    $Ready = $CursorPassed -and $DriveParity.passed -and $ChargeParity.passed
    return [PSCustomObject]@{
        schemaVersion = 1
        status = if ($Ready) { 'ready' } elseif ($CursorIncomplete) { 'incomplete' } else { 'not_ready' }
        readyForReadCanary = $Ready
        generatedAtUtc = $GeneratedAtUtc.ToUniversalTime().ToString('o')
        repositoryProvider = $RepositoryProvider
        vehicleId = New-DriveOSStableDataId -Entity vehicle -ProviderKey "tessie:$Vin"
        auditRange = [PSCustomObject]@{ days=30; fromUtc=$RangeFromUtc.ToUniversalTime().ToString('o'); toUtc=$RangeToUtc.ToUniversalTime().ToString('o') }
        maximumCursorLagMinutes = $MaximumCursorLagMinutes
        cursors = @($CursorResults)
        resources = [PSCustomObject]@{ drives=$DriveParity; charges=$ChargeParity }
        checks = @(
            [PSCustomObject]@{ name='cursor-readiness'; passed=$CursorPassed },
            [PSCustomObject]@{ name='drive-parity'; passed=$DriveParity.passed },
            [PSCustomObject]@{ name='charging-parity'; passed=$ChargeParity.passed }
        )
    }
}

Export-ModuleMember -Function Get-JourneyDeckPayloadHash,Compare-JourneyDeckTessieResource,New-JourneyDeckTessieParityReport
