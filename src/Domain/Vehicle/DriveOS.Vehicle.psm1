function Get-DriveOSVehicleProperty {
    param($Object, [string]$Name)
    if ($null -ne $Object -and $Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $null
}

function ConvertTo-DriveOSVehicleSummary {
    param([Parameter(Mandatory=$true)]$Vehicle)
    $state = $Vehicle.last_state
    $charge = $state.charge_state
    $climate = $state.climate_state
    $drive = Get-DriveOSVehicleProperty -Object $state -Name 'drive_state'
    $vehicleState = Get-DriveOSVehicleProperty -Object $state -Name 'vehicle_state'
    $insideF = if ($null -ne $climate.inside_temp) { [math]::Round(($climate.inside_temp * 9 / 5) + 32) } else { $null }
    $outsideF = if ($null -ne $climate.outside_temp) { [math]::Round(($climate.outside_temp * 9 / 5) + 32) } else { $null }
    [PSCustomObject]@{
        name = $state.display_name; state = $state.state; battery = $charge.battery_level
        rangeMiles = if ($null -ne $charge.battery_range) { [math]::Round($charge.battery_range) } else { $null }
        charging = $charge.charging_state; chargeLimit = $charge.charge_limit_soc
        insideTempF = $insideF; outsideTempF = $outsideF
        latitude = Get-DriveOSVehicleProperty -Object $drive -Name 'latitude'
        longitude = Get-DriveOSVehicleProperty -Object $drive -Name 'longitude'
        heading = Get-DriveOSVehicleProperty -Object $drive -Name 'heading'
        speedMph = Get-DriveOSVehicleProperty -Object $drive -Name 'speed'
        shiftState = Get-DriveOSVehicleProperty -Object $drive -Name 'shift_state'
        gpsAsOf = Get-DriveOSVehicleProperty -Object $drive -Name 'gps_as_of'
        odometerMiles = Get-DriveOSVehicleProperty -Object $vehicleState -Name 'odometer'
    }
}

Export-ModuleMember -Function ConvertTo-DriveOSVehicleSummary
