Set-StrictMode -Version 2.0

function Get-DriveOSTimelineRecordValue {
    param([AllowNull()]$Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function ConvertFrom-DriveOSGeoPoint {
    param([Parameter(Mandatory=$true)][string]$Value)
    if ($Value -notmatch '^geo:(-?[0-9.]+),(-?[0-9.]+)$') { throw "Unsupported Timeline point: $Value" }
    return [PSCustomObject]@{ latitude=[double]$Matches[1]; longitude=[double]$Matches[2] }
}

function Test-DriveOSTimelineOverlap {
    param(
        [Parameter(Mandatory=$true)][DateTimeOffset]$Start,
        [Parameter(Mandatory=$true)][DateTimeOffset]$End,
        [object[]]$ExistingDrives=@(),
        [ValidateRange(0,30)][int]$ToleranceMinutes=5
    )
    foreach ($Drive in @($ExistingDrives)) {
        $StartedAt = Get-DriveOSTimelineRecordValue $Drive 'started_at'
        $EndedAt = Get-DriveOSTimelineRecordValue $Drive 'ended_at'
        if ($null -eq $StartedAt -or $null -eq $EndedAt) { continue }
        $ExistingStart = [DateTimeOffset]::FromUnixTimeSeconds([long]$StartedAt)
        $ExistingEnd = [DateTimeOffset]::FromUnixTimeSeconds([long]$EndedAt)
        if ($End -ge $ExistingStart.AddMinutes(-$ToleranceMinutes) -and $Start -le $ExistingEnd.AddMinutes($ToleranceMinutes)) { return $true }
    }
    return $false
}

function New-DriveOSTimelineImportPlan {
    param(
        [Parameter(Mandatory=$true)][string]$InputPath,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFrom,
        [DateTimeOffset]$RangeTo=[DateTimeOffset]::UtcNow,
        [ValidateRange(0,1)][double]$MinimumConfidence=.5,
        [object[]]$ExistingDrives=@(),
        [string]$HouseholdId='household_primary'
    )
    if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) { throw "Timeline export not found: $InputPath" }
    $Timeline = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @()
    $Seen = 0
    $RejectedConfidence = 0
    $RejectedOverlap = 0
    foreach ($Segment in @($Timeline)) {
        $Activity = Get-DriveOSTimelineRecordValue $Segment 'activity'
        $Candidate = Get-DriveOSTimelineRecordValue $Activity 'topCandidate'
        if (-not $Activity -or "$(Get-DriveOSTimelineRecordValue $Candidate 'type')" -ne 'in passenger vehicle') { continue }
        $Start = [DateTimeOffset]$Segment.startTime
        $End = [DateTimeOffset]$Segment.endTime
        if ($Start -lt $RangeFrom -or $Start -gt $RangeTo) { continue }
        $Seen++
        $Confidence = [double](Get-DriveOSTimelineRecordValue $Candidate 'probability')
        if ($Confidence -lt $MinimumConfidence) { $RejectedConfidence++; continue }
        if (Test-DriveOSTimelineOverlap -Start $Start -End $End -ExistingDrives $ExistingDrives) { $RejectedOverlap++; continue }
        $StartPoint = ConvertFrom-DriveOSGeoPoint -Value ([string]$Activity.start)
        $EndPoint = ConvertFrom-DriveOSGeoPoint -Value ([string]$Activity.end)
        $StartedEpoch = $Start.ToUnixTimeSeconds()
        $EndedEpoch = $End.ToUnixTimeSeconds()
        $DistanceMiles = [math]::Round(([double]$Activity.distanceMeters / 1609.344),3)
        $ProviderId = "$StartedEpoch-$EndedEpoch"
        $Raw = [ordered]@{
            id = "google-timeline:$ProviderId"
            source = 'google_timeline'
            reconstructed = $true
            reconstruction_confidence = $Confidence
            started_at = $StartedEpoch
            ended_at = $EndedEpoch
            starting_location = 'Google Timeline location'
            ending_location = 'Google Timeline location'
            starting_latitude = $StartPoint.latitude
            starting_longitude = $StartPoint.longitude
            ending_latitude = $EndPoint.latitude
            ending_longitude = $EndPoint.longitude
            starting_battery = $null
            ending_battery = $null
            odometer_distance = $DistanceMiles
            energy_used = $null
            average_speed = $null
            max_speed = $null
            tag = 'Reconstructed'
            driver_profile = 'Google Timeline'
        }
        $Rows += [PSCustomObject]@{
            providerDriveId=$ProviderId; legacyDriveId=$ProviderId
            startedAtUtc=$Start.ToUniversalTime().ToString('o'); endedAtUtc=$End.ToUniversalTime().ToString('o')
            startedAtEpoch=$StartedEpoch; endedAtEpoch=$EndedEpoch
            startingLocation=$Raw.starting_location; endingLocation=$Raw.ending_location
            startingLatitude=$StartPoint.latitude; startingLongitude=$StartPoint.longitude
            endingLatitude=$EndPoint.latitude; endingLongitude=$EndPoint.longitude
            distanceMiles=$DistanceMiles; confidence=$Confidence
            rawPayloadJson=($Raw | ConvertTo-Json -Depth 10 -Compress)
        }
    }
    $TotalMiles = if ($Rows.Count) { [math]::Round((($Rows | Measure-Object distanceMiles -Sum).Sum),1) } else { 0 }
    return [PSCustomObject]@{
        provider='google_timeline'; householdId=$HouseholdId
        rangeFromUtc=$RangeFrom.ToUniversalTime().ToString('o'); rangeToUtc=$RangeTo.ToUniversalTime().ToString('o')
        passengerSegmentsSeen=$Seen; rejectedForConfidence=$RejectedConfidence; rejectedForOverlap=$RejectedOverlap
        records=@($Rows); candidateCount=$Rows.Count
        totalMiles=$TotalMiles
    }
}

Export-ModuleMember -Function ConvertFrom-DriveOSGeoPoint,Test-DriveOSTimelineOverlap,New-DriveOSTimelineImportPlan
