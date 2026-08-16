function Get-DriveOSMobilityGraphValue {
    param($Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if ($Property) { return $Property.Value }
    return $null
}

function ConvertTo-DriveOSMobilityCoordinate {
    param($Value)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace("$Value")) { return $null }
    try { return [Convert]::ToDouble($Value,[Globalization.CultureInfo]::InvariantCulture) }
    catch { return $null }
}

function Get-DriveOSMobilityDistanceMiles {
    param([double]$LatitudeA,[double]$LongitudeA,[double]$LatitudeB,[double]$LongitudeB)
    $ToRadians = [Math]::PI / 180
    $LatDelta = ($LatitudeB - $LatitudeA) * $ToRadians
    $LonDelta = ($LongitudeB - $LongitudeA) * $ToRadians
    $A = [Math]::Sin($LatDelta / 2) * [Math]::Sin($LatDelta / 2) +
        [Math]::Cos($LatitudeA * $ToRadians) * [Math]::Cos($LatitudeB * $ToRadians) *
        [Math]::Sin($LonDelta / 2) * [Math]::Sin($LonDelta / 2)
    return 3958.7613 * 2 * [Math]::Atan2([Math]::Sqrt($A),[Math]::Sqrt(1 - $A))
}

function Get-DriveOSMobilityId {
    param([Parameter(Mandatory=$true)][string]$Kind,[Parameter(Mandatory=$true)][string]$Key)
    $Sha = [Security.Cryptography.SHA256]::Create()
    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes("$Kind`:$Key")
        $Hash = ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
        return "$Kind-$($Hash.Substring(0,12))"
    }
    finally { $Sha.Dispose() }
}

function Get-DriveOSMobilityLocationKey {
    param([AllowNull()][string]$Label)
    if ([string]::IsNullOrWhiteSpace($Label)) { return 'unknown location' }
    return (($Label.Trim().ToLowerInvariant() -replace '[^\p{L}\p{Nd}]+',' ') -replace '\s+',' ').Trim()
}

function Find-DriveOSMobilityNode {
    param([object[]]$Nodes,[string]$Label,$Latitude,$Longitude)
    $LocationKey = Get-DriveOSMobilityLocationKey -Label $Label
    foreach ($Node in @($Nodes)) {
        if ($Node.locationKey -eq $LocationKey) { return $Node }
        if ($null -ne $Latitude -and $null -ne $Longitude -and $null -ne $Node.latitude -and $null -ne $Node.longitude) {
            $Distance = Get-DriveOSMobilityDistanceMiles -LatitudeA $Latitude -LongitudeA $Longitude -LatitudeB $Node.latitude -LongitudeB $Node.longitude
            if ($Distance -le 0.2) { return $Node }
        }
    }
    return $null
}

function New-DriveOSMobilityGraph {
    param([object[]]$Drives = @(),[ValidateRange(1,730)][int]$WindowDays = 365)

    $Nodes = [Collections.ArrayList]::new()
    $Edges = @{}
    $IncludedDriveIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $TotalMiles = 0.0

    foreach ($Drive in @($Drives | Where-Object { $null -ne $_ } | Sort-Object { "$(Get-DriveOSMobilityGraphValue $_ 'startedAt')" })) {
        $DriveId = "$(Get-DriveOSMobilityGraphValue $Drive 'id')"
        if ([string]::IsNullOrWhiteSpace($DriveId)) { continue }

        $StartLabel = "$(Get-DriveOSMobilityGraphValue $Drive 'startingLocation')".Trim()
        $EndLabel = "$(Get-DriveOSMobilityGraphValue $Drive 'endingLocation')".Trim()
        if ([string]::IsNullOrWhiteSpace($StartLabel)) { $StartLabel = 'Unknown start' }
        if ([string]::IsNullOrWhiteSpace($EndLabel)) { $EndLabel = 'Unknown destination' }
        $StartLatitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $Drive 'startingLatitude')
        $StartLongitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $Drive 'startingLongitude')
        $EndLatitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $Drive 'endingLatitude')
        $EndLongitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $Drive 'endingLongitude')

        $EndpointSpecs = @(
            [PSCustomObject]@{ label=$StartLabel; latitude=$StartLatitude; longitude=$StartLongitude; direction='departure' },
            [PSCustomObject]@{ label=$EndLabel; latitude=$EndLatitude; longitude=$EndLongitude; direction='arrival' }
        )
        $ResolvedNodes = @()
        foreach ($Endpoint in $EndpointSpecs) {
            $Node = Find-DriveOSMobilityNode -Nodes @($Nodes) -Label $Endpoint.label -Latitude $Endpoint.latitude -Longitude $Endpoint.longitude
            if (-not $Node) {
                $LocationKey = Get-DriveOSMobilityLocationKey -Label $Endpoint.label
                $CoordinateKey = if ($null -ne $Endpoint.latitude -and $null -ne $Endpoint.longitude) {
                    '{0:F3},{1:F3}' -f $Endpoint.latitude,$Endpoint.longitude
                } else { 'no-coordinate' }
                $Node = [PSCustomObject]@{
                    id = Get-DriveOSMobilityId -Kind 'place' -Key "$LocationKey|$CoordinateKey"
                    locationKey = $LocationKey
                    label = $Endpoint.label
                    kind = if ($LocationKey -eq 'home') { 'home' } else { 'place' }
                    latitude = $Endpoint.latitude
                    longitude = $Endpoint.longitude
                    arrivals = 0
                    departures = 0
                    miles = 0.0
                    firstSeenAt = $null
                    lastSeenAt = $null
                    driveIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
                }
                $null = $Nodes.Add($Node)
            }
            if ($Endpoint.direction -eq 'arrival') { $Node.arrivals++ } else { $Node.departures++ }
            $null = $Node.driveIds.Add($DriveId)
            $StartedAt = "$(Get-DriveOSMobilityGraphValue $Drive 'startedAt')"
            if (-not $Node.firstSeenAt -or $StartedAt -lt $Node.firstSeenAt) { $Node.firstSeenAt = $StartedAt }
            if (-not $Node.lastSeenAt -or $StartedAt -gt $Node.lastSeenAt) { $Node.lastSeenAt = $StartedAt }
            $ResolvedNodes += $Node
        }

        if ($ResolvedNodes.Count -ne 2) { continue }
        $Miles = 0.0
        try { $Miles = [Convert]::ToDouble((Get-DriveOSMobilityGraphValue $Drive 'miles'),[Globalization.CultureInfo]::InvariantCulture) } catch {}
        $Minutes = 0.0
        try { $Minutes = [Convert]::ToDouble((Get-DriveOSMobilityGraphValue $Drive 'durationMinutes'),[Globalization.CultureInfo]::InvariantCulture) } catch {}
        $Efficiency = $null
        try { $Efficiency = [Convert]::ToDouble((Get-DriveOSMobilityGraphValue $Drive 'efficiencyWhMi'),[Globalization.CultureInfo]::InvariantCulture) } catch {}
        $TotalMiles += $Miles
        $null = $IncludedDriveIds.Add($DriveId)
        $ResolvedNodes[0].miles += $Miles
        $ResolvedNodes[1].miles += $Miles

        $EdgeKey = "$($ResolvedNodes[0].id)>$($ResolvedNodes[1].id)"
        if (-not $Edges.ContainsKey($EdgeKey)) {
            $Edges[$EdgeKey] = [PSCustomObject]@{
                id = Get-DriveOSMobilityId -Kind 'connection' -Key $EdgeKey
                source = $ResolvedNodes[0].id
                target = $ResolvedNodes[1].id
                driveCount = 0
                totalMiles = 0.0
                totalMinutes = 0.0
                efficiencyTotal = 0.0
                efficiencyCount = 0
                firstDrivenAt = $null
                lastDrivenAt = $null
                driveIds = [Collections.Generic.List[string]]::new()
            }
        }
        $Edge = $Edges[$EdgeKey]
        $Edge.driveCount++
        $Edge.totalMiles += $Miles
        $Edge.totalMinutes += $Minutes
        if ($null -ne $Efficiency) { $Edge.efficiencyTotal += $Efficiency; $Edge.efficiencyCount++ }
        $StartedAt = "$(Get-DriveOSMobilityGraphValue $Drive 'startedAt')"
        if (-not $Edge.firstDrivenAt -or $StartedAt -lt $Edge.firstDrivenAt) { $Edge.firstDrivenAt = $StartedAt }
        if (-not $Edge.lastDrivenAt -or $StartedAt -gt $Edge.lastDrivenAt) { $Edge.lastDrivenAt = $StartedAt }
        $Edge.driveIds.Add($DriveId)
    }

    $PublicNodes = @($Nodes | ForEach-Object {
        [PSCustomObject]@{
            id=$_.id;label=$_.label;kind=$_.kind;latitude=$_.latitude;longitude=$_.longitude
            visitCount=$_.driveIds.Count;arrivals=$_.arrivals;departures=$_.departures
            totalMiles=[Math]::Round($_.miles,1);firstSeenAt=$_.firstSeenAt;lastSeenAt=$_.lastSeenAt
        }
    } | Sort-Object @{Expression='visitCount';Descending=$true},@{Expression='lastSeenAt';Descending=$true})
    $PublicEdges = @($Edges.Values | ForEach-Object {
        [PSCustomObject]@{
            id=$_.id;source=$_.source;target=$_.target;driveCount=$_.driveCount
            totalMiles=[Math]::Round($_.totalMiles,1);averageMiles=if($_.driveCount){[Math]::Round($_.totalMiles/$_.driveCount,1)}else{0}
            averageMinutes=if($_.driveCount){[Math]::Round($_.totalMinutes/$_.driveCount,0)}else{0}
            averageEfficiencyWhMi=if($_.efficiencyCount){[Math]::Round($_.efficiencyTotal/$_.efficiencyCount,0)}else{$null}
            firstDrivenAt=$_.firstDrivenAt;lastDrivenAt=$_.lastDrivenAt;driveIds=@($_.driveIds)
        }
    } | Sort-Object @{Expression='driveCount';Descending=$true},@{Expression='lastDrivenAt';Descending=$true})

    return [PSCustomObject]@{
        version=1
        generatedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
        windowDays=$WindowDays
        summary=[PSCustomObject]@{
            placeCount=$PublicNodes.Count
            connectionCount=$PublicEdges.Count
            driveCount=$IncludedDriveIds.Count
            totalMiles=[Math]::Round($TotalMiles,1)
        }
        nodes=$PublicNodes
        edges=$PublicEdges
    }
}

Export-ModuleMember -Function New-DriveOSMobilityGraph
