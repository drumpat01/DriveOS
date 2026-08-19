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
    $CreatedAt=if($Existing){
        if($Existing.createdAtUtc -is [DateTime] -or $Existing.createdAtUtc -is [DateTimeOffset]){([DateTimeOffset]$Existing.createdAtUtc).ToUniversalTime().ToString('o')}
        else{"$($Existing.createdAtUtc)"}
    }else{$Now}
    $Memory=[PSCustomObject]@{id=$Id;name=$CleanName;notes=$CleanNotes;artworkKey=$CleanArtwork;collectionIds=@($Unique);createdAtUtc=$CreatedAt;updatedAtUtc=$Now}
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

function Get-JourneyMemoryRecordValue {
    param($Record,[string[]]$Names)
    if($null-eq$Record){return $null}
    foreach($Name in $Names){if($Record.PSObject.Properties[$Name]){return $Record.$Name}}
    return $null
}

function Get-JourneyMemorySeason {
    param([DateTimeOffset]$Moment)
    $Name=if($Moment.Month-in 3..5){'Spring'}elseif($Moment.Month-in 6..8){'Summer'}elseif($Moment.Month-in 9..11){'Autumn'}else{'Winter'}
    return "$($Moment.Year):$Name"
}

function Get-JourneyMemoryCollectionContext {
    param($Collection,[hashtable]$DriveMap)
    $DriveIds=@(Get-JourneyMemoryRecordValue $Collection @('driveIds'))
    $Members=@($DriveIds|ForEach-Object{$Id="$($_)";if($DriveMap.ContainsKey($Id)){$DriveMap[$Id]}}|Where-Object{$null-ne$_})
    $Places=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $Artists=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $Seasons=@{};$Dates=New-Object System.Collections.Generic.List[DateTimeOffset];$Miles=0.0;$Songs=0;$Night=0;$Weekend=0
    foreach($Drive in $Members){
        foreach($LocationName in @('startingLocation','endingLocation')){$Value="$(Get-JourneyMemoryRecordValue $Drive @($LocationName))".Trim();if($Value){$null=$Places.Add($Value)}}
        foreach($Song in @(Get-JourneyMemoryRecordValue $Drive @('soundtrack'))){$Artist="$(Get-JourneyMemoryRecordValue $Song @('artist'))".Trim();if($Artist){$null=$Artists.Add($Artist)}}
        $SongValue=Get-JourneyMemoryRecordValue $Drive @('songCount');if($null-ne$SongValue){try{$Songs+=[int]$SongValue}catch{}}else{$Songs+=@((Get-JourneyMemoryRecordValue $Drive @('soundtrack'))|Where-Object{$null-ne$_}).Count}
        try{$Miles+=[double](Get-JourneyMemoryRecordValue $Drive @('miles','distanceMiles'))}catch{}
        $RawDate="$(Get-JourneyMemoryRecordValue $Drive @('startedAt','startedAtUtc','dateIso'))".Trim();if($RawDate){try{$Moment=[DateTimeOffset]::Parse($RawDate);$Dates.Add($Moment);$Season=Get-JourneyMemorySeason $Moment;$SeasonCount=if($Seasons.ContainsKey($Season)){[int]$Seasons[$Season]}else{0};$Seasons[$Season]=1+$SeasonCount;if($Moment.Hour-ge19-or$Moment.Hour-lt6){$Night++};if($Moment.DayOfWeek-in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)){$Weekend++}}catch{}}
    }
    $Tokens=@("$(Get-JourneyMemoryRecordValue $Collection @('name'))".ToLowerInvariant()-split'[^a-z0-9]+'|Where-Object{$_.Length-ge3-and$_-notin @('the','and','drives','journeys','collection') }|Select-Object -Unique)
    $Dominant=@($Seasons.GetEnumerator()|Sort-Object -Property @{Expression='Value';Descending=$true},@{Expression='Name';Descending=$false}|Select-Object -First 1)
    return [PSCustomObject]@{
        collection=$Collection;id="$(Get-JourneyMemoryRecordValue $Collection @('id'))";driveIds=@($Members|ForEach-Object{"$(Get-JourneyMemoryRecordValue $_ @('id'))"}|Where-Object{$_}|Select-Object -Unique)
        places=@($Places);artists=@($Artists);tokens=$Tokens;journeyCount=$Members.Count;miles=$Miles;songs=$Songs;nightCount=$Night;weekendCount=$Weekend
        dominantSeason=if($Dominant.Count){"$($Dominant[0].Name)"}else{''};firstDate=if($Dates.Count){@($Dates|Sort-Object|Select-Object -First 1)[0]}else{$null};lastDate=if($Dates.Count){@($Dates|Sort-Object -Descending|Select-Object -First 1)[0]}else{$null}
    }
}

function Get-JourneyMemoryContextScore {
    param($Left,$Right)
    $SharedDrives=@($Left.driveIds|Where-Object{$Right.driveIds-contains$_}).Count
    $SharedPlaces=@($Left.places|Where-Object{$Right.places-contains$_}).Count
    $SharedArtists=@($Left.artists|Where-Object{$Right.artists-contains$_}).Count
    $SharedTokens=@($Left.tokens|Where-Object{$Right.tokens-contains$_}).Count
    $Score=([Math]::Min(2,$SharedDrives)*4)+([Math]::Min(2,$SharedPlaces)*2)+([Math]::Min(2,$SharedArtists)*2)+[Math]::Min(2,$SharedTokens)
    if($Left.dominantSeason-and$Left.dominantSeason-eq$Right.dominantSeason){$Score+=3}
    if($Left.journeyCount-and$Right.journeyCount){
        $LeftNight=$Left.nightCount/$Left.journeyCount;$RightNight=$Right.nightCount/$Right.journeyCount;if(($LeftNight-ge.5)-eq($RightNight-ge.5)){$Score++}
        $LeftWeekend=$Left.weekendCount/$Left.journeyCount;$RightWeekend=$Right.weekendCount/$Right.journeyCount;if(($LeftWeekend-ge.5)-eq($RightWeekend-ge.5)){$Score++}
    }
    if($Left.lastDate-and$Right.firstDate){$Gap=[Math]::Abs(($Left.lastDate-$Right.firstDate).TotalDays);if($Gap-le45){$Score+=2}}
    return $Score
}

function Update-JourneyMemorySuggestions {
    param($Repository,[object[]]$Collections=@(),[object[]]$Drives=@(),[string]$HouseholdId='household_primary',[DateTimeOffset]$AsOfUtc=[DateTimeOffset]::UtcNow)
    $Now=$AsOfUtc.ToUniversalTime().ToString('o');$CurrentCollections=@($Collections|Where-Object{Get-JourneyMemoryRecordValue $_ @('id')}|Select-Object -First 80)
    $DriveMap=@{};foreach($Drive in @($Drives)){$DriveId="$(Get-JourneyMemoryRecordValue $Drive @('id'))";if($DriveId){$DriveMap[$DriveId]=$Drive}}
    $ExistingByKey=@{};foreach($Status in @('suggested','dismissed','accepted','stale')){foreach($Item in @(Get-DriveOSMemorySuggestions -Repository $Repository -Status $Status -HouseholdId $HouseholdId)){$ExistingByKey["$($Item.suggestionKey)"]=$Item}}
    $PublishedKeys=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $Publish={param($Suggestion)
        $Key="$($Suggestion.suggestionKey)";$Existing=if($ExistingByKey.ContainsKey($Key)){$ExistingByKey[$Key]}else{$null}
        if($Existing-and"$($Existing.status)"-eq'accepted'){return $false}
        if($Existing-and"$($Existing.status)"-eq'dismissed'){$DismissedAt=$null;try{$DismissedAt=[DateTimeOffset]::Parse("$($Existing.updatedAtUtc)")}catch{};if($DismissedAt-and$DismissedAt-gt$AsOfUtc.AddDays(-30)){return $false}}
        Set-DriveOSMemorySuggestion -Repository $Repository -Suggestion $Suggestion -HouseholdId $HouseholdId
        if($Existing-and"$($Existing.status)"-in @('dismissed','stale')){Set-DriveOSMemorySuggestionStatus -Repository $Repository -SuggestionId $Suggestion.id -Status suggested -HouseholdId $HouseholdId}
        $null=$PublishedKeys.Add($Key);return $true
    }
    $Contexts=@($CurrentCollections|ForEach-Object{Get-JourneyMemoryCollectionContext -Collection $_ -DriveMap $DriveMap})
    $CandidateGroups=@{}
    foreach($Seed in $Contexts){
        $Related=@($Contexts|Where-Object{$_.id-ne$Seed.id}|ForEach-Object{[PSCustomObject]@{context=$_;score=(Get-JourneyMemoryContextScore $Seed $_)}}|Where-Object{$_.score-ge3}|Sort-Object score -Descending|Select-Object -First 3)
        if($Related.Count){$Group=@($Seed)+@($Related|ForEach-Object{$_.context});$Ids=@($Group.id|Sort-Object -Unique);$GroupKey=$Ids-join'|';$Score=@($Related|Measure-Object score -Sum).Sum;if(-not$CandidateGroups.ContainsKey($GroupKey)-or$CandidateGroups[$GroupKey].score-lt$Score){$CandidateGroups[$GroupKey]=[PSCustomObject]@{contexts=$Group;score=$Score}}}
    }
    if(-not$CandidateGroups.Count-and$Contexts.Count-ge2){$Fallback=@($Contexts|Sort-Object journeyCount -Descending|Select-Object -First 4);$CandidateGroups[(@($Fallback.id|Sort-Object)-join'|')]=[PSCustomObject]@{contexts=$Fallback;score=1}}
    $ExistingMemorySets=@{};foreach($Memory in @(Get-JourneyMemories -Repository $Repository -HouseholdId $HouseholdId)){$ExistingMemorySets[(@((Get-JourneyMemoryRecordValue $Memory @('collectionIds'))|Sort-Object)-join'|')]=$true}
    $Titles=@{}
    foreach($Candidate in @($CandidateGroups.Values|Sort-Object score -Descending|Select-Object -First 5)){
        $Ids=@($Candidate.contexts.id|Sort-Object -Unique);$SetKey=$Ids-join'|';if($Ids.Count-lt2-or$ExistingMemorySets.ContainsKey($SetKey)){continue}
        $GroupDriveIds=@($Candidate.contexts.driveIds|Select-Object -Unique);$GroupDrives=@($GroupDriveIds|ForEach-Object{if($DriveMap.ContainsKey($_)){$DriveMap[$_]}}|Where-Object{$null-ne$_});$Night=0;$Weekend=0;$Miles=0.0;$Songs=0;$Seasons=@{}
        foreach($Drive in $GroupDrives){try{$Miles+=[double](Get-JourneyMemoryRecordValue $Drive @('miles','distanceMiles'))}catch{};$SongValue=Get-JourneyMemoryRecordValue $Drive @('songCount');if($null-ne$SongValue){try{$Songs+=[int]$SongValue}catch{}}else{$Songs+=@((Get-JourneyMemoryRecordValue $Drive @('soundtrack'))|Where-Object{$null-ne$_}).Count};$Raw="$(Get-JourneyMemoryRecordValue $Drive @('startedAt','startedAtUtc','dateIso'))";if($Raw){try{$Moment=[DateTimeOffset]::Parse($Raw);$Season=Get-JourneyMemorySeason $Moment;$SeasonCount=if($Seasons.ContainsKey($Season)){[int]$Seasons[$Season]}else{0};$Seasons[$Season]=1+$SeasonCount;if($Moment.Hour-ge19-or$Moment.Hour-lt6){$Night++};if($Moment.DayOfWeek-in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)){$Weekend++}}catch{}}}
        $Count=$GroupDrives.Count;$Dominant=@($Seasons.GetEnumerator()|Sort-Object -Property @{Expression='Value';Descending=$true},@{Expression='Name';Descending=$false}|Select-Object -First 1);$Signals=New-Object System.Collections.Generic.List[string]
        if($Count-and$Night/$Count-ge.55){$Title='Favorite Night Drives';$Artwork='golden-hour-drives';$Signals.Add('similar nighttime driving patterns')}
        elseif($Count-and$Weekend/$Count-ge.55){$Title='Weekend Escapes';$Artwork='weekend-escapes';$Signals.Add('weekend journey patterns')}
        elseif($Dominant.Count-and$Dominant[0].Value/[Math]::Max(1,$Count)-ge.55){$Parts="$($Dominant[0].Name)"-split':';$Title="$($Parts[1]) $($Parts[0])";$Artwork='summer-2026';$Signals.Add("journeys from the same $($Parts[1].ToLowerInvariant()) season")}
        else{$CommonPlace=@($Candidate.contexts.places|Where-Object{$_-and$_-notmatch'^(home|start|destination)$'}|Group-Object|Where-Object{$_.Count-ge2}|Sort-Object Count -Descending|Select-Object -First 1);if($CommonPlace.Count){$Label=(Get-Culture).TextInfo.ToTitleCase("$($CommonPlace[0].Name)".ToLowerInvariant());$Title="$Label Drives";$Artwork='road-trips';$Signals.Add("shared routes around $Label")}else{$Title='Connected Journeys';$Artwork='road-trips';$Signals.Add('related routes, timing, places, or music')}}
        if($Titles.ContainsKey($Title.ToLowerInvariant())){continue};$Titles[$Title.ToLowerInvariant()]=$true
        $Key="memory:context:"+(New-JourneyMemoryStableId key $SetKey).Substring(4);$Description="Suggested from $($Ids.Count) related collections and $Count journeys because they share $($Signals[0])."
        $Suggestion=[PSCustomObject]@{id=(New-JourneyMemoryStableId suggestion $Key);kind='memory';suggestionKey=$Key;title=$Title;description=$Description;payload=[PSCustomObject]@{collectionIds=$Ids;driveIds=$GroupDriveIds;artworkKey=$Artwork;signals=@($Signals);journeyCount=$Count;miles=[Math]::Round($Miles,1);songs=$Songs;score=$Candidate.score};status='suggested';createdAtUtc=$Now;updatedAtUtc=$Now}
        $null=&$Publish $Suggestion
    }
    $RecentIds=@($Drives|Where-Object{Get-JourneyMemoryRecordValue $_ @('id')}|Select-Object -First 8|ForEach-Object{"$(Get-JourneyMemoryRecordValue $_ @('id'))"})
    if($RecentIds.Count -ge 2){
        $Key='collection:recent-favorites';$Suggestion=[PSCustomObject]@{id=(New-JourneyMemoryStableId suggestion $Key);kind='collection';suggestionKey=$Key;title='Recent favorites';description="A suggested collection from $($RecentIds.Count) recent journeys.";payload=[PSCustomObject]@{driveIds=$RecentIds;artworkKey='golden-hour-drives'};status='suggested';createdAtUtc=$Now;updatedAtUtc=$Now}
        $null=&$Publish $Suggestion
    }
    foreach($Old in @(Get-DriveOSMemorySuggestions -Repository $Repository -Status suggested -HouseholdId $HouseholdId)){if(-not$PublishedKeys.Contains("$($Old.suggestionKey)")){Set-DriveOSMemorySuggestionStatus -Repository $Repository -SuggestionId "$($Old.id)" -Status stale -HouseholdId $HouseholdId}}
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
