function Find-NearestDriveOSHistoricalState {
    param([Parameter(Mandatory=$true)][object[]]$States, [Parameter(Mandatory=$true)][long]$TargetTimestamp)
    $best = $null
    $bestDifference = [double]::PositiveInfinity
    foreach ($state in $States) {
        if ($null -eq $state.timestamp -or $null -eq $state.latitude -or $null -eq $state.longitude) { continue }
        $difference = [math]::Abs([double]$state.timestamp - [double]$TargetTimestamp)
        if ($difference -lt $bestDifference) { $best = $state; $bestDifference = $difference }
    }
    return $best
}

function ConvertTo-DriveOSMapPoint {
    param($State)
    if (-not $State) { return $null }
    $localTime = [DateTimeOffset]::FromUnixTimeSeconds([long]$State.timestamp).ToLocalTime()
    [PSCustomObject]@{
        timestamp = [long]$State.timestamp; time = $localTime.ToString('h:mm:ss tt')
        latitude = [double]$State.latitude; longitude = [double]$State.longitude
        speed = $State.speed; heading = $State.heading; battery = $State.battery_level
    }
}

Export-ModuleMember -Function Find-NearestDriveOSHistoricalState,ConvertTo-DriveOSMapPoint
