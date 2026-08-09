function ConvertTo-DriveOSVehicleSummary {
    param([Parameter(Mandatory=$true)]$Vehicle)
    $state = $Vehicle.last_state
    $charge = $state.charge_state
    $climate = $state.climate_state
    $insideF = if ($null -ne $climate.inside_temp) { [math]::Round(($climate.inside_temp * 9 / 5) + 32) } else { $null }
    $outsideF = if ($null -ne $climate.outside_temp) { [math]::Round(($climate.outside_temp * 9 / 5) + 32) } else { $null }
    [PSCustomObject]@{
        name = $state.display_name; state = $state.state; battery = $charge.battery_level
        rangeMiles = if ($null -ne $charge.battery_range) { [math]::Round($charge.battery_range) } else { $null }
        charging = $charge.charging_state; chargeLimit = $charge.charge_limit_soc
        insideTempF = $insideF; outsideTempF = $outsideF
    }
}

Export-ModuleMember -Function ConvertTo-DriveOSVehicleSummary
