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

Export-ModuleMember -Function Get-DriveOSPlaceCacheKey,Select-DriveOSPlaceLookupCandidates
