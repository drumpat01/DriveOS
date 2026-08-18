Set-StrictMode -Version 2.0

function Get-JourneyCollections {
    param([Parameter(Mandatory=$true)]$Repository,[string]$HouseholdId='household_primary')
    return @(Get-DriveOSJourneyCollections -Repository $Repository -HouseholdId $HouseholdId)
}

function Save-JourneyCollection {
    param([Parameter(Mandatory=$true)]$Repository,[AllowNull()][string]$CollectionId,[AllowNull()][string]$Name,[AllowNull()][string]$Description,[AllowNull()][object[]]$DriveIds,[string]$HouseholdId='household_primary')
    $CleanName = "$Name".Trim()
    $CleanDescription = "$Description".Trim()
    if (-not $CleanName) { throw 'Collection name is required.' }
    if ($CleanName.Length -gt 80) { throw 'Collection name must be 80 characters or fewer.' }
    if ($CleanDescription.Length -gt 500) { throw 'Collection description must be 500 characters or fewer.' }
    $UniqueDriveIds = New-Object System.Collections.Generic.List[string]
    $Seen = @{}
    foreach ($Value in @($DriveIds)) {
        $DriveId = "$Value".Trim()
        if (-not $DriveId) { throw 'Collection drive IDs must not be empty.' }
        if (-not $Seen.ContainsKey($DriveId)) { $Seen[$DriveId]=$true; $UniqueDriveIds.Add($DriveId) }
    }
    if ($UniqueDriveIds.Count -gt 100) { throw 'A collection may contain at most 100 drives.' }
    $Existing = $null
    $Id = "$CollectionId".Trim()
    if ($Id) {
        if ($Id -notmatch '^collection_[a-f0-9]{32}$') { throw 'Collection ID is invalid.' }
        $Matches = @(Get-JourneyCollections -Repository $Repository -HouseholdId $HouseholdId | Where-Object { "$($_.id)" -eq $Id } | Select-Object -First 1)
        if (-not $Matches.Count) { throw 'Collection was not found.' }
        $Existing = $Matches[0]
    }
    else { $Id = 'collection_' + [guid]::NewGuid().ToString('N') }
    $Now = [DateTimeOffset]::UtcNow.ToString('o')
    $Collection = [PSCustomObject]@{ id=$Id; name=$CleanName; description=$CleanDescription; driveIds=@($UniqueDriveIds); createdAtUtc=$(if($Existing){[string]$Existing.createdAtUtc}else{$Now}); updatedAtUtc=$Now }
    Set-DriveOSJourneyCollection -Repository $Repository -Collection $Collection -HouseholdId $HouseholdId
    return $Collection
}

function Remove-JourneyCollection {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)][string]$CollectionId,[string]$HouseholdId='household_primary')
    $Id = "$CollectionId".Trim()
    if ($Id -notmatch '^collection_[a-f0-9]{32}$') { throw 'Collection ID is invalid.' }
    Remove-DriveOSJourneyCollection -Repository $Repository -CollectionId $Id -HouseholdId $HouseholdId
    return [PSCustomObject]@{ deleted=$true; collectionId=$Id }
}

Export-ModuleMember -Function Get-JourneyCollections,Save-JourneyCollection,Remove-JourneyCollection
