Set-StrictMode -Version 2.0

$script:MemoryArtworkKeys=@('everyday-life','weekend-escapes','summer-2026','sunday-drives','road-trips','texas-weekends','golden-hour-drives')
$script:MemoryImageTypes=@('image/jpeg','image/png','image/webp')

function New-JourneyMemoryStableId {
    param([Parameter(Mandatory=$true)][string]$Prefix,[Parameter(Mandatory=$true)][string]$Key)
    $Sha=[Security.Cryptography.SHA256]::Create()
    try{$Bytes=[Text.Encoding]::UTF8.GetBytes("journeydeck-memory`0$Key");$Hex=([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant();return "${Prefix}_$($Hex.Substring(0,32))"}
    finally{$Sha.Dispose()}
}

function Get-JourneyMemories {
    param([Parameter(Mandatory=$true)]$Repository,[string]$HouseholdId='household_primary')
    return @(Get-DriveOSMemories -Repository $Repository -HouseholdId $HouseholdId)
}

function Save-JourneyMemory {
    param($Repository,[AllowNull()][string]$MemoryId,[AllowNull()][string]$Name,[AllowNull()][string]$Notes,[AllowNull()][string]$ArtworkKey,[AllowNull()][object[]]$CollectionIds,[AllowNull()][string]$SuggestionId,[string]$HouseholdId='household_primary')
    $CleanName="$Name".Trim();$CleanNotes="$Notes".Trim();$CleanArtwork="$ArtworkKey".Trim()
    if(-not $CleanName){throw 'Memory name is required.'}
    if($CleanName.Length -gt 80){throw 'Memory name must be 80 characters or fewer.'}
    if($CleanNotes.Length -gt 1200){throw 'Memory notes must be 1200 characters or fewer.'}
    if(-not $CleanArtwork){$CleanArtwork='summer-2026'}
    if($CleanArtwork -notin $script:MemoryArtworkKeys){throw 'Memory artwork is invalid.'}
    $Unique=New-Object System.Collections.Generic.List[string];$Seen=@{}
    foreach($Value in @($CollectionIds)){$Id="$Value".Trim();if($Id -notmatch '^collection_[a-f0-9]{32}$'){throw 'Memory collection ID is invalid.'};if(-not $Seen.ContainsKey($Id)){$Seen[$Id]=$true;$Unique.Add($Id)}}
    if($Unique.Count -lt 2){throw 'A memory must contain at least two collections.'}
    if($Unique.Count -gt 50){throw 'A memory may contain at most 50 collections.'}
    $Available=@(Get-DriveOSJourneyCollections -Repository $Repository -HouseholdId $HouseholdId);$AvailableIds=@{}
    foreach($Collection in $Available){$AvailableIds["$($Collection.id)"]=$true}
    foreach($CollectionIdValue in $Unique){if(-not $AvailableIds.ContainsKey($CollectionIdValue)){throw 'One or more memory collections no longer exist.'}}
    $Existing=$null;$Id="$MemoryId".Trim()
    if($Id){if($Id -notmatch '^memory_[a-f0-9]{32}$'){throw 'Memory ID is invalid.'};$Match=@(Get-JourneyMemories -Repository $Repository -HouseholdId $HouseholdId|Where-Object{"$($_.id)" -eq $Id});if(-not $Match.Count){throw 'Memory was not found.'};$Existing=$Match[0]}
    else{$Id='memory_'+[guid]::NewGuid().ToString('N')}
    $Now=[DateTimeOffset]::UtcNow.ToString('o')
    $Memory=[PSCustomObject]@{id=$Id;name=$CleanName;notes=$CleanNotes;artworkKey=$CleanArtwork;collectionIds=@($Unique);createdAtUtc=$(if($Existing){[string]$Existing.createdAtUtc}else{$Now});updatedAtUtc=$Now}
    Set-DriveOSMemory -Repository $Repository -Memory $Memory -HouseholdId $HouseholdId
    if("$SuggestionId".Trim()){Set-JourneyMemorySuggestionStatus -Repository $Repository -SuggestionId "$SuggestionId".Trim() -Status accepted -HouseholdId $HouseholdId|Out-Null}
    return $Memory
}

function Remove-JourneyMemory {
    param($Repository,[string]$MemoryId,[string]$HouseholdId='household_primary')
    if($MemoryId -notmatch '^memory_[a-f0-9]{32}$'){throw 'Memory ID is invalid.'}
    Remove-DriveOSMemory -Repository $Repository -MemoryId $MemoryId -HouseholdId $HouseholdId
    return [PSCustomObject]@{deleted=$true;memoryId=$MemoryId}
}

function Get-JourneyMemorySuggestions {
    param($Repository,[string]$Status='suggested',[string]$HouseholdId='household_primary')
    if($Status -notin @('suggested','accepted','dismissed')){throw 'Memory suggestion status is invalid.'}
    return @(Get-DriveOSMemorySuggestions -Repository $Repository -Status $Status -HouseholdId $HouseholdId)
}

function Update-JourneyMemorySuggestions {
    param($Repository,[object[]]$Collections=@(),[object[]]$Drives=@(),[string]$HouseholdId='household_primary')
    $Now=[DateTimeOffset]::UtcNow.ToString('o');$CurrentCollections=@($Collections|Where-Object{$_.id})
    if($CurrentCollections.Count -ge 2){
        $Month=[DateTimeOffset]::Now.Month;$Season=if($Month -in 3..5){'Spring'}elseif($Month -in 6..8){'Summer'}elseif($Month -in 9..11){'Autumn'}else{'Winter'}
        $Key="memory:season:$([DateTimeOffset]::Now.Year):$Season".ToLowerInvariant();$Ids=@($CurrentCollections|Select-Object -First 4|ForEach-Object{"$($_.id)"})
        $Suggestion=[PSCustomObject]@{id=(New-JourneyMemoryStableId suggestion $Key);kind='memory';suggestionKey=$Key;title="$Season $([DateTimeOffset]::Now.Year)";description="Built from $($Ids.Count) of your collections.";payload=[PSCustomObject]@{collectionIds=$Ids;artworkKey='summer-2026'};status='suggested';createdAtUtc=$Now;updatedAtUtc=$Now}
        Set-DriveOSMemorySuggestion -Repository $Repository -Suggestion $Suggestion -HouseholdId $HouseholdId
    }
    $RecentIds=@($Drives|Where-Object{$_.id}|Select-Object -First 8|ForEach-Object{"$($_.id)"})
    if($RecentIds.Count -ge 2){
        $Key='collection:recent-favorites';$Suggestion=[PSCustomObject]@{id=(New-JourneyMemoryStableId suggestion $Key);kind='collection';suggestionKey=$Key;title='Recent favorites';description="A suggested collection from $($RecentIds.Count) recent journeys.";payload=[PSCustomObject]@{driveIds=$RecentIds;artworkKey='golden-hour-drives'};status='suggested';createdAtUtc=$Now;updatedAtUtc=$Now}
        Set-DriveOSMemorySuggestion -Repository $Repository -Suggestion $Suggestion -HouseholdId $HouseholdId
    }
    return @(Get-JourneyMemorySuggestions -Repository $Repository -HouseholdId $HouseholdId)
}

function Set-JourneyMemorySuggestionStatus {
    param($Repository,[string]$SuggestionId,[string]$Status,[string]$HouseholdId='household_primary')
    if($SuggestionId -notmatch '^suggestion_[a-f0-9]{32}$'){throw 'Memory suggestion ID is invalid.'}
    if($Status -notin @('suggested','accepted','dismissed')){throw 'Memory suggestion status is invalid.'}
    Set-DriveOSMemorySuggestionStatus -Repository $Repository -SuggestionId $SuggestionId -Status $Status -HouseholdId $HouseholdId
    return [PSCustomObject]@{updated=$true;suggestionId=$SuggestionId;status=$Status}
}

function Add-JourneyMemoryAttachment {
    param($Repository,[string]$MemoryId,[string]$FileName,[string]$ContentType,[string]$DataBase64,[string]$HouseholdId='household_primary')
    if($MemoryId -notmatch '^memory_[a-f0-9]{32}$'){throw 'Memory ID is invalid.'}
    $SafeName=[IO.Path]::GetFileName("$FileName").Trim();if(-not $SafeName -or $SafeName.Length -gt 120){throw 'Memory photo filename is invalid.'}
    $Type="$ContentType".Trim().ToLowerInvariant();if($Type -notin $script:MemoryImageTypes){throw 'Memory photos must be JPEG, PNG, or WebP images.'}
    try{$Bytes=[Convert]::FromBase64String("$DataBase64")}catch{throw 'Memory photo data is invalid.'}
    if($Bytes.Length -lt 1 -or $Bytes.Length -gt 1572864){throw 'Memory photos must be 1.5 MB or smaller.'}
    if(-not (Test-JourneyAttachmentSignature -Bytes $Bytes -ContentType $Type)){throw 'Memory photo content does not match its file type.'}
    if(-not @(Get-JourneyMemories -Repository $Repository -HouseholdId $HouseholdId|Where-Object{"$($_.id)" -eq $MemoryId}|Select-Object -First 1).Count){throw 'Memory was not found.'}
    if(@(Get-DriveOSMemoryAttachments -Repository $Repository -MemoryId $MemoryId -HouseholdId $HouseholdId).Count -ge 12){throw 'A memory may contain at most 12 photos.'}
    $Record=[PSCustomObject]@{id='memory_attachment_'+[guid]::NewGuid().ToString('N');memoryId=$MemoryId;fileName=$SafeName;contentType=$Type;byteLength=$Bytes.Length;dataBase64="$DataBase64";createdAtUtc=[DateTimeOffset]::UtcNow.ToString('o')}
    Set-DriveOSMemoryAttachment -Repository $Repository -Record $Record -HouseholdId $HouseholdId
    return [PSCustomObject]@{id=$Record.id;memoryId=$MemoryId;fileName=$SafeName;contentType=$Type;byteLength=$Bytes.Length;createdAtUtc=$Record.createdAtUtc}
}

function Remove-JourneyMemoryAttachment {
    param($Repository,[string]$AttachmentId,[string]$HouseholdId='household_primary')
    if($AttachmentId -notmatch '^memory_attachment_[a-f0-9]{32}$'){throw 'Memory photo ID is invalid.'}
    Remove-DriveOSMemoryAttachment -Repository $Repository -AttachmentId $AttachmentId -HouseholdId $HouseholdId
    return [PSCustomObject]@{deleted=$true;attachmentId=$AttachmentId}
}

Export-ModuleMember -Function Get-JourneyMemories,Save-JourneyMemory,Remove-JourneyMemory,Get-JourneyMemorySuggestions,Update-JourneyMemorySuggestions,Set-JourneyMemorySuggestionStatus,Add-JourneyMemoryAttachment,Remove-JourneyMemoryAttachment,New-JourneyMemoryStableId
