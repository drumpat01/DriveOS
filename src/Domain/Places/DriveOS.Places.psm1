function New-DriveOSPlaceAliasMap {
    param([object[]]$Entries = @())
    $map = @{}
    foreach ($entry in @($Entries)) {
        if ($entry.location -and $entry.label) { $map[[string]$entry.location] = [string]$entry.label }
    }
    return $map
}

function Resolve-DriveOSFriendlyLocation {
    param([string]$Location, [hashtable]$AliasMap)
    if ([string]::IsNullOrWhiteSpace($Location)) { return $Location }
    if ($AliasMap -and $AliasMap.ContainsKey($Location)) { return $AliasMap[$Location] }
    return $Location
}

function Update-DriveOSPlaceAliasEntries {
    param([object[]]$Entries = @(), [Parameter(Mandatory=$true)][string]$Location, [string]$Label = '')
    $locationValue = $Location.Trim()
    $labelValue = $Label.Trim()
    if (-not $locationValue -or $locationValue.Length -gt 512) { throw 'A valid location is required.' }
    if ($labelValue.Length -gt 64) { throw 'Friendly place names must be 64 characters or fewer.' }
    $output = New-Object System.Collections.ArrayList
    $found = $false
    foreach ($entry in @($Entries)) {
        if ([string]$entry.location -eq $locationValue) {
            $found = $true
            if ($labelValue) { [void]$output.Add([pscustomobject]@{location=$locationValue;label=$labelValue}) }
        } else {
            [void]$output.Add([pscustomobject]@{location=[string]$entry.location;label=[string]$entry.label})
        }
    }
    if (-not $found -and $labelValue) { [void]$output.Add([pscustomobject]@{location=$locationValue;label=$labelValue}) }
    return @($output)
}

Export-ModuleMember -Function New-DriveOSPlaceAliasMap,Resolve-DriveOSFriendlyLocation,Update-DriveOSPlaceAliasEntries
