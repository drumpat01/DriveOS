function ConvertTo-DriveOSCharge {
    param([Parameter(Mandatory=$true)]$Charge, $Settings, [string]$FriendlyLocation)
    $start = [DateTimeOffset]::FromUnixTimeSeconds([long]$Charge.started_at).ToLocalTime()
    $end = [DateTimeOffset]::FromUnixTimeSeconds([long]$Charge.ended_at).ToLocalTime()
    $durationMinutes = [math]::Max(0, [math]::Round(($end - $start).TotalMinutes))
    $energyAdded = if ($null -ne $Charge.energy_added) { [math]::Round([double]$Charge.energy_added, 2) } else { $null }
    $recordedCost = if ($null -ne $Charge.cost -and [double]$Charge.cost -gt 0) { [math]::Round([double]$Charge.cost, 2) } else { $null }
    $estimatedCost = $null
    if (
        $null -eq $recordedCost -and
        $null -ne $energyAdded -and
        -not [bool]$Charge.is_supercharger
    ) {
        $estimatedCost = [math]::Round($energyAdded * 0.14, 2)
    }
    [PSCustomObject]@{
        id=[string]$Charge.id; startedAt=$start.ToString('o'); endedAt=$end.ToString('o')
        dateLabel=$start.ToString('ddd, MMM d'); dateIso=$start.ToString('yyyy-MM-dd')
        startTime=$start.ToString('h:mm tt'); endTime=$end.ToString('h:mm tt'); durationMinutes=$durationMinutes
        location=$FriendlyLocation; rawLocation=$Charge.location; latitude=$Charge.latitude; longitude=$Charge.longitude
        isSupercharger=[bool]$Charge.is_supercharger; odometer=$Charge.odometer; energyAddedKWh=$energyAdded
        energyUsedKWh=if ($null -ne $Charge.energy_used) { [math]::Round([double]$Charge.energy_used,2) } else { $null }
        milesAdded=if ($null -ne $Charge.miles_added) { [math]::Round([double]$Charge.miles_added,1) } else { $null }
        startingBattery=$Charge.starting_battery; endingBattery=$Charge.ending_battery
        recordedCost=$recordedCost; estimatedCost=$estimatedCost
        displayCost=if ($null -ne $recordedCost) { $recordedCost } else { $estimatedCost }
        costType=if ($null -ne $recordedCost) { 'recorded' } elseif ($null -ne $estimatedCost) { 'estimated' } else { 'unknown' }
    }
}

Export-ModuleMember -Function ConvertTo-DriveOSCharge
