Set-StrictMode -Version 2.0

function Get-DriveOSPlaceCacheKey {
    param(
        [string]$Location,
        $Latitude = $null,
        $Longitude = $null
    )

    $GenericLocation = [string]::IsNullOrWhiteSpace($Location) -or $Location.Trim() -match '^(Google Timeline location|Unknown (start|destination|location))$'
    $Normalized = if ($GenericLocation -and $null -ne $Latitude -and $null -ne $Longitude) {
        [string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0:F4},{1:F4}", [double]$Latitude, [double]$Longitude)
    }
    elseif (-not [string]::IsNullOrWhiteSpace($Location)) {
        ($Location.Trim().ToLowerInvariant() -replace '\s+', ' ')
    }
    elseif ($null -ne $Latitude -and $null -ne $Longitude) {
        [string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0:F4},{1:F4}", [double]$Latitude, [double]$Longitude)
    }
    else { return $null }

    $Hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes($Normalized)
        return ([BitConverter]::ToString($Hasher.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally { $Hasher.Dispose() }
}

function Select-DriveOSPlaceLookupCandidates {
    param(
        [object[]]$Candidates = @(),
        [ValidateRange(1,500)][int]$Limit = 500
    )

    return @($Candidates |
        Where-Object {
            [int]$_.uses -ge 1 -and
            [string]::IsNullOrWhiteSpace([string]$_.manualLabel) -and
            $null -ne $_.latitude -and $null -ne $_.longitude -and
            [double]$_.latitude -ge -90 -and [double]$_.latitude -le 90 -and
            [double]$_.longitude -ge -180 -and [double]$_.longitude -le 180
        } |
        Sort-Object @{Expression='uses';Descending=$true}, location |
        Select-Object -First $Limit)
}

function Select-DriveOSFoursquareMatch {
    param(
        [object[]]$Places = @(),
        [ValidateRange(1,250)][int]$MaximumDistanceMeters = 60
    )

    return @($Places |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace([string]$_.name) -and
            $null -ne $_.distanceMeters -and
            [double]$_.distanceMeters -ge 0 -and
            [double]$_.distanceMeters -le $MaximumDistanceMeters
        } |
        Sort-Object distanceMeters |
        Select-Object -First 1)[0]
}

function Get-DriveOSFoursquareUsageWindow {
    param(
        $Usage,
        [datetime]$Now = (Get-Date),
        [ValidateRange(1,1000)][int]$DailyLimit = 10,
        [ValidateRange(1,10000)][int]$MonthlyLimit = 250
    )

    $Today = $Now.ToString('yyyy-MM-dd')
    $Month = $Now.ToString('yyyy-MM')
    $TodayCount = if ($Usage -and "$($Usage.day)" -eq $Today) { [int]$Usage.dayCount } else { 0 }
    $MonthCount = if ($Usage -and "$($Usage.month)" -eq $Month) { [int]$Usage.monthCount } else { 0 }

    [PSCustomObject]@{
        day = $Today
        dayCount = $TodayCount
        dayLimit = $DailyLimit
        dayRemaining = [Math]::Max(0, $DailyLimit - $TodayCount)
        month = $Month
        monthCount = $MonthCount
        monthLimit = $MonthlyLimit
        monthRemaining = [Math]::Max(0, $MonthlyLimit - $MonthCount)
        canCall = ($TodayCount -lt $DailyLimit -and $MonthCount -lt $MonthlyLimit)
    }
}

Export-ModuleMember -Function Get-DriveOSPlaceCacheKey,Select-DriveOSPlaceLookupCandidates,Select-DriveOSFoursquareMatch,Get-DriveOSFoursquareUsageWindow
