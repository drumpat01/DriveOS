function Get-JourneyDeckMobilityPreferenceValue {
    param($Record,[string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if ($Property) { return $Property.Value }
    return $null
}

function Get-MobilityPreferences {
    param([Parameter(Mandatory=$true)]$Repository)
    $Stored = Get-DriveOSMobilityPreferencesRecord -Repository $Repository
    return [PSCustomObject]@{
        version = 2
        updatedAt = Get-JourneyDeckMobilityPreferenceValue $Stored 'updatedAt'
        places = @((Get-JourneyDeckMobilityPreferenceValue $Stored 'places') | Where-Object { $null -ne $_ })
        routines = @((Get-JourneyDeckMobilityPreferenceValue $Stored 'routines') | Where-Object { $null -ne $_ })
        placeGeofences = @((Get-JourneyDeckMobilityPreferenceValue $Stored 'placeGeofences') | Where-Object { $null -ne $_ })
    }
}

function Save-MobilityPreferences {
    param([Parameter(Mandatory=$true)]$Repository,[object[]]$Places=@(),[object[]]$Routines=@(),[object[]]$PlaceGeofences=@())
    $Record = [PSCustomObject]@{
        version = 2
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        places = @($Places)
        routines = @($Routines)
        placeGeofences = @($PlaceGeofences)
    }
    Set-DriveOSMobilityPreferencesRecord -Repository $Repository -Preferences $Record
    return $Record
}

function Set-MobilityPlacePreference {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Candidate)
    $NodeId = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'nodeId')".Trim().ToLowerInvariant()
    if ($NodeId -notmatch '^place-[a-f0-9]{12}$') { throw 'A valid mobility place ID is required.' }
    $Current = Get-MobilityPreferences -Repository $Repository
    $Places = @($Current.places | Where-Object { "$(Get-JourneyDeckMobilityPreferenceValue $_ 'nodeId')" -ne $NodeId })
    if ([bool](Get-JourneyDeckMobilityPreferenceValue $Candidate 'reset')) {
        return Save-MobilityPreferences -Repository $Repository -Places $Places -Routines @($Current.routines) -PlaceGeofences @($Current.placeGeofences)
    }
    $Name = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'name')".Trim()
    $Category = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'category')".Trim().ToLowerInvariant()
    if (-not $Name -or $Name.Length -gt 80) { throw 'Place name must be between 1 and 80 characters.' }
    if ($Category -notin @('home','work','family','errands','dining','wellness','other')) { throw 'Choose a valid place category.' }
    $Places += [PSCustomObject]@{nodeId=$NodeId;name=$Name;category=$Category;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
    return Save-MobilityPreferences -Repository $Repository -Places $Places -Routines @($Current.routines) -PlaceGeofences @($Current.placeGeofences)
}

function Set-MobilityRoutinePreference {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Candidate)
    $RoutineId = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'routineId')".Trim().ToLowerInvariant()
    if ($RoutineId -notmatch '^routine-[a-f0-9]{12}$') { throw 'A valid mobility routine ID is required.' }
    $Current = Get-MobilityPreferences -Repository $Repository
    $Routines = @($Current.routines | Where-Object { "$(Get-JourneyDeckMobilityPreferenceValue $_ 'routineId')" -ne $RoutineId })
    $Status = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'status')".Trim().ToLowerInvariant()
    if ($Status -eq 'suggested') { return Save-MobilityPreferences -Repository $Repository -Places @($Current.places) -Routines $Routines -PlaceGeofences @($Current.placeGeofences) }
    if ($Status -notin @('confirmed','dismissed')) { throw 'Routine status must be confirmed, dismissed, or suggested.' }
    $Type = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'type')".Trim().ToLowerInvariant()
    $CustomName = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'customName')".Trim()
    if ($Status -eq 'confirmed' -and $Type -notin @('commute','school-run','family-visit','errand-loop','frequent-route','custom')) { throw 'Choose a valid routine type.' }
    if ($Type -eq 'custom' -and (-not $CustomName -or $CustomName.Length -gt 60)) { throw 'Custom routine name must be between 1 and 60 characters.' }
    $Routines += [PSCustomObject]@{routineId=$RoutineId;status=$Status;type=$Type;customName=$CustomName;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
    return Save-MobilityPreferences -Repository $Repository -Places @($Current.places) -Routines $Routines -PlaceGeofences @($Current.placeGeofences)
}

function Set-MobilityPlaceGeofence {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Candidate)
    $Latitude = [double](Get-JourneyDeckMobilityPreferenceValue $Candidate 'latitude')
    $Longitude = [double](Get-JourneyDeckMobilityPreferenceValue $Candidate 'longitude')
    $RadiusFeet = [double](Get-JourneyDeckMobilityPreferenceValue $Candidate 'radiusFeet')
    $Name = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'name')".Trim()
    $Category = "$(Get-JourneyDeckMobilityPreferenceValue $Candidate 'category')".Trim().ToLowerInvariant()
    if ($Latitude -lt -90 -or $Latitude -gt 90 -or $Longitude -lt -180 -or $Longitude -gt 180) { throw 'Valid geofence coordinates are required.' }
    if ($RadiusFeet -lt 25 -or $RadiusFeet -gt 2640) { throw 'Geofence radius must be between 25 and 2640 feet.' }
    if (-not $Name -or $Name.Length -gt 80) { throw 'Place name must be between 1 and 80 characters.' }
    if ($Category -notin @('home','work','family','errands','dining','wellness','other')) { throw 'Choose a valid place category.' }
    $Id = "{0:F6},{1:F6}" -f $Latitude,$Longitude
    $Current = Get-MobilityPreferences -Repository $Repository
    $Geofences = @($Current.placeGeofences | Where-Object { "$(Get-JourneyDeckMobilityPreferenceValue $_ 'id')" -ne $Id })
    $Geofences += [PSCustomObject]@{id=$Id;name=$Name;category=$Category;latitude=$Latitude;longitude=$Longitude;radiusFeet=$RadiusFeet;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
    return Save-MobilityPreferences -Repository $Repository -Places @($Current.places) -Routines @($Current.routines) -PlaceGeofences $Geofences
}

Export-ModuleMember -Function Get-MobilityPreferences,Set-MobilityPlacePreference,Set-MobilityRoutinePreference,Set-MobilityPlaceGeofence
