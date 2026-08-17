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

function Get-DriveOSMobilityCategory {
    param([string]$Label,[int]$VisitCount)
    $Key = Get-DriveOSMobilityLocationKey -Label $Label
    $Category = 'other'; $Confidence = 'low'; $Reason = 'Not enough evidence to infer a role yet.'
    if ($Key -eq 'home' -or $Key -match '(^| )home($| )') {
        $Category = 'home'; $Confidence = 'confirmed'; $Reason = 'The saved place name identifies this as Home.'
    }
    elseif ($Key -match '(^| )(work|office|school|campus|academy|high school|elementary|middle school)($| )') {
        $Category = 'work'; $Confidence = 'high'; $Reason = 'The place name indicates a work or school destination.'
    }
    elseif ($Key -match '(^| )(mom|dad|mother|father|parent|family|grandma|grandmother|grandpa|grandfather|aunt|uncle|sister|brother)($| )') {
        $Category = 'family'; $Confidence = 'high'; $Reason = 'The saved place name indicates a family destination.'
    }
    elseif ($Key -match '(^| )(market|grocery|store|shop|shopping|mall|pharmacy|target|walmart|costco|sam s|gas|hardware|bank|post office)($| )') {
        $Category = 'errands'; $Confidence = 'high'; $Reason = 'The place name matches a common errand destination.'
    }
    elseif ($Key -match '(^| )(restaurant|cafe|coffee|bar|grill|kitchen|diner|bakery)($| )') {
        $Category = 'dining'; $Confidence = 'high'; $Reason = 'The place name matches a dining destination.'
    }
    elseif ($Key -match '(^| )(gym|fitness|park|trail|lake|recreation)($| )') {
        $Category = 'wellness'; $Confidence = 'medium'; $Reason = 'The place name suggests recreation or wellness.'
    }
    elseif ($VisitCount -ge 4) {
        $Category = 'routine'; $Confidence = 'medium'; $Reason = 'Frequent visits make this part of your recurring world.'
    }
    return [PSCustomObject]@{ category=$Category; confidence=$Confidence; reason=$Reason }
}

function Get-DriveOSMobilityTimeBand {
    param([int[]]$Hours = @())
    if (-not $Hours -or $Hours.Count -eq 0) { return 'varied times' }
    $Bands = @{'morning'=0;'afternoon'=0;'evening'=0;'late night'=0}
    foreach ($Hour in $Hours) {
        if ($Hour -ge 5 -and $Hour -lt 12) { $Bands.morning++ }
        elseif ($Hour -ge 12 -and $Hour -lt 17) { $Bands.afternoon++ }
        elseif ($Hour -ge 17 -and $Hour -lt 22) { $Bands.evening++ }
        else { $Bands.'late night'++ }
    }
    return "$(($Bands.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key)"
}

function ConvertTo-DriveOSMobilityLocalTime {
    param([Parameter(Mandatory=$true)][DateTimeOffset]$Moment)
    foreach ($TimeZoneId in @('America/Chicago','Central Standard Time')) {
        try {
            $TimeZone = [TimeZoneInfo]::FindSystemTimeZoneById($TimeZoneId)
            return [TimeZoneInfo]::ConvertTime($Moment,$TimeZone)
        }
        catch { continue }
    }
    return $Moment.ToLocalTime()
}

function Get-DriveOSMobilityDayPattern {
    param([int[]]$Days = @())
    if (-not $Days -or $Days.Count -eq 0) { return 'across the week' }
    $Weekdays = @($Days | Where-Object { $_ -ge 1 -and $_ -le 5 }).Count
    $Weekends = $Days.Count - $Weekdays
    if (($Weekdays / $Days.Count) -ge 0.7) { return 'on weekdays' }
    if (($Weekends / $Days.Count) -ge 0.7) { return 'on weekends' }
    $Names = @('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
    $TopDay = $Days | Group-Object | Sort-Object Count -Descending | Select-Object -First 1
    return "most often on $($Names[[int]$TopDay.Name])"
}

function Find-DriveOSMobilityNode {
    param([object[]]$Nodes,[string]$Label,$Latitude,$Longitude)
    $LocationKey = Get-DriveOSMobilityLocationKey -Label $Label
    foreach ($Node in @($Nodes)) {
        if ($null -ne $Latitude -and $null -ne $Longitude) {
            # A coordinate-less legacy placeholder must never absorb later
            # Timeline endpoints merely because their generic labels match.
            if ($null -ne $Node.latitude -and $null -ne $Node.longitude) {
                $Distance = Get-DriveOSMobilityDistanceMiles -LatitudeA $Latitude -LongitudeA $Longitude -LatitudeB $Node.latitude -LongitudeB $Node.longitude
                if ($Distance -le 0.2) { return $Node }
            }
            continue
        }
        if ($Node.locationKey -eq $LocationKey) { return $Node }
    }
    return $null
}

function New-DriveOSMobilityGraph {
    param(
        [object[]]$Drives = @(),
        [ValidateRange(1,730)][int]$WindowDays = 365,
        [DateTimeOffset]$AsOfUtc = [DateTimeOffset]::UtcNow,
        [AllowNull()]$Preferences = $null
    )

    $Nodes = [Collections.ArrayList]::new()
    $Edges = @{}
    $IncludedDriveIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $IncludedDrives = [Collections.Generic.List[object]]::new()
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
        $StartAddress = "$(Get-DriveOSMobilityGraphValue $Drive 'rawStartingLocation')".Trim()
        $EndAddress = "$(Get-DriveOSMobilityGraphValue $Drive 'rawEndingLocation')".Trim()
        if (-not $StartAddress) { $StartAddress = $StartLabel }
        if (-not $EndAddress) { $EndAddress = $EndLabel }

        $EndpointSpecs = @(
            [PSCustomObject]@{ label=$StartLabel; address=$StartAddress; latitude=$StartLatitude; longitude=$StartLongitude; direction='departure' },
            [PSCustomObject]@{ label=$EndLabel; address=$EndAddress; latitude=$EndLatitude; longitude=$EndLongitude; direction='arrival' }
        )
        $ResolvedNodes = @()
        foreach ($Endpoint in $EndpointSpecs) {
            $Node = Find-DriveOSMobilityNode -Nodes @($Nodes) -Label $Endpoint.label -Latitude $Endpoint.latitude -Longitude $Endpoint.longitude
            if (-not $Node) {
                $LocationKey = Get-DriveOSMobilityLocationKey -Label $Endpoint.label
                $CoordinateKey = if ($null -ne $Endpoint.latitude -and $null -ne $Endpoint.longitude) {
                    '{0:F3},{1:F3}' -f $Endpoint.latitude,$Endpoint.longitude
                } else { 'no-coordinate' }
                $IdentityKey = if ($CoordinateKey -ne 'no-coordinate') { $CoordinateKey } else { $LocationKey }
                $Node = [PSCustomObject]@{
                    id = Get-DriveOSMobilityId -Kind 'place' -Key $IdentityKey
                    locationKey = $LocationKey
                    label = $Endpoint.label
                    address = $Endpoint.address
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
            elseif ($Endpoint.address -and ((-not $Node.address) -or ($Node.address -eq $Node.label -and $Endpoint.address -ne $Endpoint.label))) { $Node.address = $Endpoint.address }
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
        $IncludedDrives.Add([PSCustomObject]@{ id=$DriveId;startedAt="$(Get-DriveOSMobilityGraphValue $Drive 'startedAt')";miles=$Miles;source=$ResolvedNodes[0].id;target=$ResolvedNodes[1].id })

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

    $PlaceOverrides = @{}
    foreach ($Override in @((Get-DriveOSMobilityGraphValue $Preferences 'places'))) {
        $OverrideId = "$(Get-DriveOSMobilityGraphValue $Override 'nodeId')"
        if ($OverrideId) { $PlaceOverrides[$OverrideId] = $Override }
    }
    $PlaceGeofences = @((Get-DriveOSMobilityGraphValue $Preferences 'placeGeofences') | Where-Object { $null -ne $_ })
    $HomeGeofences = @($PlaceGeofences | Where-Object {
        "$(Get-DriveOSMobilityGraphValue $_ 'category')".Trim().ToLowerInvariant() -eq 'home' -or
        (Get-DriveOSMobilityLocationKey -Label "$(Get-DriveOSMobilityGraphValue $_ 'name')") -eq 'home'
    })
    $HomeNodes = @($Nodes | Where-Object {
        $CandidateNode = $_
        if ($CandidateNode.locationKey -eq 'home') { return $true }
        if ($null -eq $CandidateNode.latitude -or $null -eq $CandidateNode.longitude) { return $false }
        return @($HomeGeofences | Where-Object {
            $FenceLatitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $_ 'latitude')
            $FenceLongitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $_ 'longitude')
            $RadiusFeet = [double](Get-DriveOSMobilityGraphValue $_ 'radiusFeet')
            $null -ne $FenceLatitude -and $null -ne $FenceLongitude -and $RadiusFeet -gt 0 -and
            (Get-DriveOSMobilityDistanceMiles -LatitudeA $CandidateNode.latitude -LongitudeA $CandidateNode.longitude -LatitudeB $FenceLatitude -LongitudeB $FenceLongitude) -le ($RadiusFeet / 5280.0)
        }).Count -gt 0
    })
    if ($HomeNodes.Count -gt 1) {
        $LocatedHomeNodes = @($HomeNodes | Where-Object { $null -ne $_.latitude -and $null -ne $_.longitude })
        $CanonicalCandidates = if ($LocatedHomeNodes.Count) { $LocatedHomeNodes } else { $HomeNodes }
        $CanonicalHome = @($CanonicalCandidates | Sort-Object @{Expression={$_.driveIds.Count};Descending=$true} | Select-Object -First 1)[0]
        $CanonicalHome.label = 'Home'
        $CanonicalHome.locationKey = 'home'
        $CanonicalHome.kind = 'home'
        $NodeRemap = @{}
        foreach ($DuplicateHome in @($HomeNodes | Where-Object { $_.id -ne $CanonicalHome.id })) {
            $NodeRemap[$DuplicateHome.id] = $CanonicalHome.id
            foreach ($DriveId in @($DuplicateHome.driveIds)) { $null = $CanonicalHome.driveIds.Add($DriveId) }
            $CanonicalHome.arrivals += $DuplicateHome.arrivals
            $CanonicalHome.departures += $DuplicateHome.departures
            $CanonicalHome.miles += $DuplicateHome.miles
            if (-not $CanonicalHome.firstSeenAt -or ($DuplicateHome.firstSeenAt -and $DuplicateHome.firstSeenAt -lt $CanonicalHome.firstSeenAt)) { $CanonicalHome.firstSeenAt = $DuplicateHome.firstSeenAt }
            if (-not $CanonicalHome.lastSeenAt -or ($DuplicateHome.lastSeenAt -and $DuplicateHome.lastSeenAt -gt $CanonicalHome.lastSeenAt)) { $CanonicalHome.lastSeenAt = $DuplicateHome.lastSeenAt }
            if ((-not $CanonicalHome.address -or $CanonicalHome.address -eq $CanonicalHome.label) -and $DuplicateHome.address) { $CanonicalHome.address = $DuplicateHome.address }
            $null = $Nodes.Remove($DuplicateHome)
        }
        foreach ($Drive in $IncludedDrives) {
            if ($NodeRemap.ContainsKey($Drive.source)) { $Drive.source = $NodeRemap[$Drive.source] }
            if ($NodeRemap.ContainsKey($Drive.target)) { $Drive.target = $NodeRemap[$Drive.target] }
        }
        $MergedEdges = @{}
        foreach ($ExistingEdge in @($Edges.Values)) {
            $Source = if ($NodeRemap.ContainsKey($ExistingEdge.source)) { $NodeRemap[$ExistingEdge.source] } else { $ExistingEdge.source }
            $Target = if ($NodeRemap.ContainsKey($ExistingEdge.target)) { $NodeRemap[$ExistingEdge.target] } else { $ExistingEdge.target }
            if ($Source -eq $Target) { continue }
            $EdgeKey = "$Source>$Target"
            if (-not $MergedEdges.ContainsKey($EdgeKey)) {
                $MergedEdges[$EdgeKey] = [PSCustomObject]@{
                    id=Get-DriveOSMobilityId -Kind 'connection' -Key $EdgeKey
                    source=$Source;target=$Target;driveCount=0;totalMiles=0.0;totalMinutes=0.0
                    efficiencyTotal=0.0;efficiencyCount=0;firstDrivenAt=$null;lastDrivenAt=$null
                    driveIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
                }
            }
            $MergedEdge = $MergedEdges[$EdgeKey]
            $MergedEdge.driveCount += $ExistingEdge.driveCount
            $MergedEdge.totalMiles += $ExistingEdge.totalMiles
            $MergedEdge.totalMinutes += $ExistingEdge.totalMinutes
            $MergedEdge.efficiencyTotal += $ExistingEdge.efficiencyTotal
            $MergedEdge.efficiencyCount += $ExistingEdge.efficiencyCount
            foreach ($DriveId in @($ExistingEdge.driveIds)) { $null = $MergedEdge.driveIds.Add($DriveId) }
            if (-not $MergedEdge.firstDrivenAt -or ($ExistingEdge.firstDrivenAt -and $ExistingEdge.firstDrivenAt -lt $MergedEdge.firstDrivenAt)) { $MergedEdge.firstDrivenAt = $ExistingEdge.firstDrivenAt }
            if (-not $MergedEdge.lastDrivenAt -or ($ExistingEdge.lastDrivenAt -and $ExistingEdge.lastDrivenAt -gt $MergedEdge.lastDrivenAt)) { $MergedEdge.lastDrivenAt = $ExistingEdge.lastDrivenAt }
        }
        $Edges = $MergedEdges
    }
    $AllowedCategories = @('home','work','family','errands','dining','wellness','other')
    $PublicNodes = @($Nodes | ForEach-Object {
        $CandidateNode = $_
        $Identity = Get-DriveOSMobilityCategory -Label $_.label -VisitCount $_.driveIds.Count
        $GeofenceOverride = $null
        if ($null -ne $_.latitude -and $null -ne $_.longitude) {
            $GeofenceOverride = @($PlaceGeofences | Where-Object {
                $RadiusFeet = [double](Get-DriveOSMobilityGraphValue $_ 'radiusFeet')
                $FenceLatitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $_ 'latitude')
                $FenceLongitude = ConvertTo-DriveOSMobilityCoordinate (Get-DriveOSMobilityGraphValue $_ 'longitude')
                $null -ne $FenceLatitude -and $null -ne $FenceLongitude -and $RadiusFeet -gt 0 -and
                (Get-DriveOSMobilityDistanceMiles -LatitudeA $CandidateNode.latitude -LongitudeA $CandidateNode.longitude -LatitudeB $FenceLatitude -LongitudeB $FenceLongitude) -le ($RadiusFeet / 5280.0)
            } | Sort-Object { [double](Get-DriveOSMobilityGraphValue $_ 'radiusFeet') } | Select-Object -First 1)[0]
        }
        $Override = if ($PlaceOverrides.ContainsKey($_.id)) { $PlaceOverrides[$_.id] } else { $GeofenceOverride }
        $OverrideName = "$(Get-DriveOSMobilityGraphValue $Override 'name')".Trim()
        $OverrideCategory = "$(Get-DriveOSMobilityGraphValue $Override 'category')".Trim().ToLowerInvariant()
        $IsManual = $null -ne $Override -and ($OverrideName -or $AllowedCategories -contains $OverrideCategory)
        $EffectiveCategory = if($AllowedCategories -contains $OverrideCategory){$OverrideCategory}else{$Identity.category}
        [PSCustomObject]@{
            id=$_.id;label=if($OverrideName){$OverrideName}else{$_.label};originalLabel=$_.label;address=$_.address;kind=if($EffectiveCategory -eq 'home'){'home'}else{'place'}
            category=$EffectiveCategory
            categoryConfidence=if($IsManual){'manual'}else{$Identity.confidence}
            categoryReason=if($IsManual){'You assigned this place identity.'}else{$Identity.reason}
            manualOverride=$IsManual;latitude=$_.latitude;longitude=$_.longitude
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

    $NodeMap = @{}; foreach ($Node in $PublicNodes) { $NodeMap[$Node.id] = $Node }
    $RouteGroups = @{}
    foreach ($Drive in $IncludedDrives) {
        $Pair = @($Drive.source,$Drive.target) | Sort-Object
        $PairKey = "$($Pair[0])|$($Pair[1])"
        if (-not $RouteGroups.ContainsKey($PairKey)) {
            $RouteGroups[$PairKey] = [PSCustomObject]@{ a=$Pair[0];b=$Pair[1];drives=[Collections.Generic.List[object]]::new();directions=@{} }
        }
        $Group = $RouteGroups[$PairKey]
        $Group.drives.Add($Drive)
        $Direction = "$($Drive.source)>$($Drive.target)"
        if (-not $Group.directions.ContainsKey($Direction)) { $Group.directions[$Direction] = 0 }
        $Group.directions[$Direction]++
    }
    $RoutineOverrides = @{}
    foreach ($Override in @((Get-DriveOSMobilityGraphValue $Preferences 'routines'))) {
        $OverrideId = "$(Get-DriveOSMobilityGraphValue $Override 'routineId')"
        if ($OverrideId) { $RoutineOverrides[$OverrideId] = $Override }
    }
    $AllowedRoutineTypes = @('commute','school-run','family-visit','errand-loop','frequent-route','custom')
    $Routines = @($RouteGroups.Values | Where-Object {
        $_.drives.Count -ge 3 -and $_.a -ne $_.b -and
        -not ($NodeMap[$_.a].category -eq 'home' -and $NodeMap[$_.b].category -eq 'home')
    } | ForEach-Object {
        $Group = $_; $NodeA = $NodeMap[$Group.a]; $NodeB = $NodeMap[$Group.b]
        $Hours = @(); $Days = @()
        foreach ($Drive in $Group.drives) {
            try { $Moment = ConvertTo-DriveOSMobilityLocalTime ([DateTimeOffset]::Parse($Drive.startedAt)); $Hours += $Moment.Hour; $Days += [int]$Moment.DayOfWeek } catch {}
        }
        $Bidirectional = $Group.directions.Keys.Count -gt 1
        $Categories = @($NodeA.category,$NodeB.category)
        $Type = if ($Bidirectional -and $Categories -contains 'home' -and $Categories -contains 'work') { 'commute' } elseif ($Bidirectional) { 'round-trip' } else { 'frequent-route' }
        $TimeBand = Get-DriveOSMobilityTimeBand -Hours $Hours
        $DayPattern = Get-DriveOSMobilityDayPattern -Days $Days
        $ConfidenceScore = [Math]::Min(0.98,0.48 + ($Group.drives.Count * 0.07) + $(if($Bidirectional){0.08}else{0}))
        $RoutineId = Get-DriveOSMobilityId -Kind 'routine' -Key "$($Group.a)|$($Group.b)"
        $Override = if ($RoutineOverrides.ContainsKey($RoutineId)) { $RoutineOverrides[$RoutineId] } else { $null }
        $OverrideStatus = "$(Get-DriveOSMobilityGraphValue $Override 'status')".Trim().ToLowerInvariant()
        if ($OverrideStatus -notin @('confirmed','dismissed')) { $OverrideStatus = 'suggested' }
        $OverrideType = "$(Get-DriveOSMobilityGraphValue $Override 'type')".Trim().ToLowerInvariant()
        $CustomName = "$(Get-DriveOSMobilityGraphValue $Override 'customName')".Trim()
        $EffectiveType = if ($OverrideStatus -eq 'confirmed' -and $AllowedRoutineTypes -contains $OverrideType) { $OverrideType } else { $Type }
        [PSCustomObject]@{
            id=$RoutineId;type=$EffectiveType;inferredType=$Type;title=if($EffectiveType -eq 'custom' -and $CustomName){$CustomName}else{"$($NodeA.label) to $($NodeB.label)"}
            narrative="$($Group.drives.Count) journeys, $DayPattern, usually in the $TimeBand."
            source=$Group.a;target=$Group.b;driveCount=$Group.drives.Count;bidirectional=$Bidirectional
            sourceAddress=$NodeA.address;targetAddress=$NodeB.address
            typicalTime=$TimeBand;dayPattern=$DayPattern;confidence=[Math]::Round($ConfidenceScore,2)
            confidenceLabel=if($ConfidenceScore -ge .8){'high'}elseif($ConfidenceScore -ge .65){'medium'}else{'early signal'}
            confirmationStatus=$OverrideStatus;customName=$CustomName;manualOverride=($OverrideStatus -ne 'suggested')
        }
    } | Sort-Object @{Expression='driveCount';Descending=$true},title | Select-Object -First 250)

    $RecentStart = $AsOfUtc.AddDays(-30); $PriorStart = $AsOfUtc.AddDays(-60)
    $Recent = @($IncludedDrives | Where-Object { try { $Moment=[DateTimeOffset]::Parse($_.startedAt); $Moment -ge $RecentStart -and $Moment -le $AsOfUtc } catch { $false } })
    $Prior = @($IncludedDrives | Where-Object { try { $Moment=[DateTimeOffset]::Parse($_.startedAt); $Moment -ge $PriorStart -and $Moment -lt $RecentStart } catch { $false } })
    function Get-PeriodSnapshot($PeriodDrives) {
        $Places=[Collections.Generic.HashSet[string]]::new();$Miles=0.0
        foreach($Drive in @($PeriodDrives)){ $null=$Places.Add($Drive.source);$null=$Places.Add($Drive.target);$Miles+=$Drive.miles }
        return [PSCustomObject]@{driveCount=@($PeriodDrives).Count;totalMiles=[Math]::Round($Miles,1);placeCount=$Places.Count;placeIds=@($Places)}
    }
    $RecentSnapshot=Get-PeriodSnapshot $Recent;$PriorSnapshot=Get-PeriodSnapshot $Prior
    $ChangeInsights=[Collections.Generic.List[object]]::new()
    if ($PriorSnapshot.driveCount -eq 0) {
        $ChangeInsights.Add([PSCustomObject]@{type='baseline-building';direction='neutral';title='Building your comparison baseline';narrative='JourneyDeck needs activity in both 30-day periods before calling a change.';confidence='insufficient evidence'})
    }
    else {
        $DriveDelta=$RecentSnapshot.driveCount-$PriorSnapshot.driveCount
        $DrivePercent=[Math]::Round(($DriveDelta/[Math]::Max(1,$PriorSnapshot.driveCount))*100,0)
        $Direction=if($DriveDelta -gt 0){'up'}elseif($DriveDelta -lt 0){'down'}else{'stable'}
        $ChangeInsights.Add([PSCustomObject]@{type='activity-change';direction=$Direction;title=if($Direction -eq 'stable'){'Your journey rhythm is steady'}else{"Your journey activity is $Direction"};narrative="$($RecentSnapshot.driveCount) journeys in the recent 30 days versus $($PriorSnapshot.driveCount) before that ($([Math]::Abs($DrivePercent))% $Direction).";confidence='high'})
        $PlaceDelta=$RecentSnapshot.placeCount-$PriorSnapshot.placeCount
        $ChangeInsights.Add([PSCustomObject]@{type='place-diversity';direction=if($PlaceDelta -gt 0){'up'}elseif($PlaceDelta -lt 0){'down'}else{'stable'};title=if($PlaceDelta -gt 0){'Your world is widening'}elseif($PlaceDelta -lt 0){'Your world is concentrating'}else{'Your place mix is stable'};narrative="$($RecentSnapshot.placeCount) active places recently versus $($PriorSnapshot.placeCount) in the prior period.";confidence='high'})
        $PriorPlaces=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase);foreach($Id in $PriorSnapshot.placeIds){$null=$PriorPlaces.Add($Id)}
        $Emerging=@($RecentSnapshot.placeIds | Where-Object {-not $PriorPlaces.Contains($_)} | ForEach-Object {$NodeMap[$_]} | Where-Object {$null-ne $_} | Sort-Object visitCount -Descending | Select-Object -First 1)
        if($Emerging.Count){$ChangeInsights.Add([PSCustomObject]@{type='emerging-place';direction='new';title="$($Emerging[0].label) entered your recent world";narrative='This place appears in the recent 30-day period but not the previous one.';confidence='medium'})}
    }

    return [PSCustomObject]@{
        version=3
        generatedAtUtc=$AsOfUtc.ToString('o')
        windowDays=$WindowDays
        summary=[PSCustomObject]@{
            placeCount=$PublicNodes.Count
            connectionCount=$PublicEdges.Count
            driveCount=$IncludedDriveIds.Count
            totalMiles=[Math]::Round($TotalMiles,1)
        }
        nodes=$PublicNodes
        edges=$PublicEdges
        routines=$Routines
        placeGeofences=@($PlaceGeofences | ForEach-Object {
            [PSCustomObject]@{name="$(Get-DriveOSMobilityGraphValue $_ 'name')";category="$(Get-DriveOSMobilityGraphValue $_ 'category')";latitude=Get-DriveOSMobilityGraphValue $_ 'latitude';longitude=Get-DriveOSMobilityGraphValue $_ 'longitude';radiusFeet=Get-DriveOSMobilityGraphValue $_ 'radiusFeet'}
        })
        periodComparison=[PSCustomObject]@{periodDays=30;recent=$RecentSnapshot;prior=$PriorSnapshot}
        changeInsights=@($ChangeInsights)
    }
}

Export-ModuleMember -Function New-DriveOSMobilityGraph
