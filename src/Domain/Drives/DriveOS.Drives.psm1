function ConvertTo-DriveOSDrive {
    param([Parameter(Mandatory=$true)]$Drive,[object[]]$Soundtrack=@(),[string]$StartingLocation,[string]$EndingLocation)

    $startUtc = [DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.started_at)
    $endUtc = [DateTimeOffset]::FromUnixTimeSeconds([long]$Drive.ended_at)

    if ($env:DRIVEOS_MODE -eq "web") {
        function ConvertTo-DriveOSCentralTime {
            param([DateTimeOffset]$UtcValue)

            $UtcValue = $UtcValue.ToUniversalTime()
            $Year = $UtcValue.Year

            $MarchFirst = [DateTimeOffset]::new(
                $Year, 3, 1, 0, 0, 0, [TimeSpan]::Zero
            )
            $MarchDaysToSunday = (7 - [int]$MarchFirst.DayOfWeek) % 7
            $DstStartUtc = $MarchFirst.AddDays(
                $MarchDaysToSunday + 7
            ).AddHours(8)

            $NovemberFirst = [DateTimeOffset]::new(
                $Year, 11, 1, 0, 0, 0, [TimeSpan]::Zero
            )
            $NovemberDaysToSunday = (7 - [int]$NovemberFirst.DayOfWeek) % 7
            $DstEndUtc = $NovemberFirst.AddDays(
                $NovemberDaysToSunday
            ).AddHours(7)

            $Offset = if (
                $UtcValue -ge $DstStartUtc -and
                $UtcValue -lt $DstEndUtc
            ) {
                [TimeSpan]::FromHours(-5)
            }
            else {
                [TimeSpan]::FromHours(-6)
            }

            return $UtcValue.ToOffset($Offset)
        }

        $start = ConvertTo-DriveOSCentralTime $startUtc
        $end = ConvertTo-DriveOSCentralTime $endUtc
    }
    else {
        $start = $startUtc.ToLocalTime()
        $end = $endUtc.ToLocalTime()
    }
    $duration=[math]::Max(0,[math]::Round(($end-$start).TotalMinutes))
    $battery=if($null -ne $Drive.starting_battery -and $null -ne $Drive.ending_battery){[int]$Drive.starting_battery-[int]$Drive.ending_battery}else{$null}
    $miles=if($null -ne $Drive.odometer_distance){[math]::Round([double]$Drive.odometer_distance,1)}else{$null}
    $energy=if($null -ne $Drive.energy_used){[math]::Round([double]$Drive.energy_used,2)}else{$null}
    $efficiency=if($miles -and $miles -gt 0 -and $null -ne $energy){[math]::Round(($energy*1000)/$miles)}else{$null}
    [pscustomobject]@{
        id="$($Drive.started_at)-$($Drive.ended_at)";startedAt=$start.ToString('o');endedAt=$end.ToString('o')
        dateLabel=$start.ToString('dddd, MMMM d');shortDateLabel=$start.ToString('ddd, MMM d');dateIso=$start.ToString('yyyy-MM-dd');dateNumeric=$start.ToString('M/d/yyyy')
        startTime=$start.ToString('h:mm tt');endTime=$end.ToString('h:mm tt');startingLocation=$StartingLocation;endingLocation=$EndingLocation
        rawStartingLocation=$Drive.starting_location;rawEndingLocation=$Drive.ending_location;startingLatitude=$Drive.starting_latitude;startingLongitude=$Drive.starting_longitude
        endingLatitude=$Drive.ending_latitude;endingLongitude=$Drive.ending_longitude;tessieTag=$Drive.tag;driverProfile=$Drive.driver_profile
        durationMinutes=$duration;miles=$miles;startingBattery=$Drive.starting_battery;endingBattery=$Drive.ending_battery;batteryUsed=$battery
        energyKWh=$energy;efficiencyWhMi=$efficiency;averageSpeed=$Drive.average_speed;maxSpeed=$Drive.max_speed;soundtrack=@($Soundtrack);songCount=@($Soundtrack).Count
    }
}
Export-ModuleMember -Function ConvertTo-DriveOSDrive

