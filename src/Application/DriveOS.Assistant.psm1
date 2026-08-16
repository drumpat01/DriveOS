function Get-DriveOSAssistantTimeZone {
    foreach ($Id in @('Central Standard Time','America/Chicago')) { try { return [TimeZoneInfo]::FindSystemTimeZoneById($Id) } catch {} }
    return [TimeZoneInfo]::Local
}

function New-DriveOSAssistantLocalBoundary {
    param([Parameter(Mandatory=$true)][datetime]$LocalDate,[Parameter(Mandatory=$true)][TimeZoneInfo]$TimeZone)
    $Unspecified=[DateTime]::SpecifyKind($LocalDate,[DateTimeKind]::Unspecified)
    return [DateTimeOffset]::new($Unspecified,$TimeZone.GetUtcOffset($Unspecified))
}

function Get-DriveOSAssistantTimeRange {
    param([string]$Question,[DateTimeOffset]$Now=[DateTimeOffset]::Now)
    $Text="$Question".ToLowerInvariant();$Zone=Get-DriveOSAssistantTimeZone;$LocalNow=[TimeZoneInfo]::ConvertTime($Now,$Zone)
    $Start=$null;$End=$Now;$Label=$null;$PeriodDays=$null
    if($Text-match'\b(20\d{2})\b'){
        $Year=[int]$Matches[1];$Start=New-DriveOSAssistantLocalBoundary ([datetime]::new($Year,1,1)) $Zone;$Next=New-DriveOSAssistantLocalBoundary ([datetime]::new($Year+1,1,1)) $Zone
        $End=if($Year-eq$LocalNow.Year){$Now}else{$Next.AddTicks(-1)};$Label=if($Year-eq$LocalNow.Year){"$Year so far"}else{"$Year"}
    }elseif($Text-match'\b(last year|previous year)\b'){
        $Year=$LocalNow.Year-1;$Start=New-DriveOSAssistantLocalBoundary ([datetime]::new($Year,1,1)) $Zone;$End=(New-DriveOSAssistantLocalBoundary ([datetime]::new($Year+1,1,1)) $Zone).AddTicks(-1);$Label="$Year"
    }elseif($Text-match'\b(this year|year to date|ytd)\b'){
        $Year=$LocalNow.Year;$Start=New-DriveOSAssistantLocalBoundary ([datetime]::new($Year,1,1)) $Zone;$Label="$Year so far"
    }elseif($Text-match'\b(last month|previous month)\b'){
        $Month=[datetime]::new($LocalNow.Year,$LocalNow.Month,1).AddMonths(-1);$Start=New-DriveOSAssistantLocalBoundary $Month $Zone;$End=(New-DriveOSAssistantLocalBoundary $Month.AddMonths(1) $Zone).AddTicks(-1);$Label=$Month.ToString('MMMM yyyy')
    }elseif($Text-match'\b(this month|month to date|mtd)\b'){
        $Month=[datetime]::new($LocalNow.Year,$LocalNow.Month,1);$Start=New-DriveOSAssistantLocalBoundary $Month $Zone;$Label="$($LocalNow.ToString('MMMM yyyy')) so far"
    }elseif($Text-match'\b(today|today s)\b'){
        $Start=New-DriveOSAssistantLocalBoundary $LocalNow.Date $Zone;$Label='today'
    }else{
        $PeriodDays=if($Text-match'\b(14 days|two weeks)\b'){14}elseif($Text-match'\b(week|7 days|seven days)\b'){7}elseif($Text-match'\b(year|365 days)\b'){365}else{30}
        $Start=$Now.AddDays(-$PeriodDays);$Label="the last $PeriodDays days"
    }
    return [pscustomobject]@{start=$Start.ToUniversalTime();end=$End.ToUniversalTime();label=$Label;periodDays=$PeriodDays;timezone='America/Chicago'}
}

function Get-DriveOSAssistantDriveTime {
    param($Drive)
    foreach($Name in @('startedAt','started_at')){if($Drive.PSObject.Properties[$Name]){try{return [DateTimeOffset]::Parse("$($Drive.$Name)")}catch{}}}
    return $null
}

function Get-DriveOSAssistantDrivingSongs {
    param([object[]]$Drives=@())
    $Songs=New-Object Collections.ArrayList;$Seen=@{}
    foreach($Drive in $Drives){foreach($Song in @($Drive.soundtrack|Where-Object{$null-ne$_-and$_.track})){
        $PlayedAt=if($Song.PSObject.Properties['playedAt']){"$($Song.playedAt)"}else{"$($Song.played_at)"};$Key="$($Drive.id)|$PlayedAt|$($Song.trackId)|$($Song.track)|$($Song.artist)"
        if($Seen.ContainsKey($Key)){continue};$Seen[$Key]=$true;[void]$Songs.Add([pscustomobject]@{track=$Song.track;artist=$Song.artist;playedAt=$PlayedAt;source=$Song.source;driveId=$Drive.id})
    }}
    return @($Songs)
}

function Get-DriveOSAssistantAnswer {
    param([Parameter(Mandatory=$true)][string]$Question,[object[]]$Drives=@(),[object[]]$History=@(),[object[]]$Places=@(),[object[]]$Charges=@(),[DateTimeOffset]$Now=[DateTimeOffset]::Now)
    $Text="$Question".Trim();if($Text.Length-lt3-or$Text.Length-gt500){throw'Ask a question between 3 and 500 characters.'}
    $Normalized=($Text.ToLowerInvariant()-replace'[^a-z0-9]+',' ').Trim();$Range=Get-DriveOSAssistantTimeRange -Question $Text -Now $Now
    $RecentDrives=@($Drives|Where-Object{$Time=Get-DriveOSAssistantDriveTime $_;$null-ne$Time-and$Time.ToUniversalTime()-ge$Range.start-and$Time.ToUniversalTime()-le$Range.end});$DrivingSongs=@(Get-DriveOSAssistantDrivingSongs -Drives $RecentDrives)
    $DrivingWhen=if($Range.label-eq'today'){'today'}elseif($Range.label-like'the last*'){"during $($Range.label)"}else{"in $($Range.label)"}
    $Base=[ordered]@{question=$Text;scope='while_driving';filters=[ordered]@{scope='while_driving';rangeLabel=$Range.label;rangeStart=$Range.start.ToString('o');rangeEnd=$Range.end.ToString('o');periodDays=$Range.periodDays;timezone=$Range.timezone};evidence=@();suggestions=@('How many miles did I drive this month?','What was my longest drive of 2026?','What was my most-played track of 2026?','Where did I drive most this month?')}

    if($Normalized-match'\b(listen|song|music|track)\b.*\b(?:drive|trip)\s+to\s+(.+)$'){
        $Destination=$Matches[2].Trim();$Matching=@($RecentDrives|Where-Object{("$($_.endingLocation) $($_.rawEndingLocation)".ToLowerInvariant())-like"*$Destination*"}|Sort-Object{Get-DriveOSAssistantDriveTime $_}-Descending);$Base.operation='drive_music';$Base.filters.destination=$Destination
        if(-not$Matching){$Base.answer="I could not find a recorded drive to $Destination during $($Range.label).";return [pscustomobject]$Base};$Drive=$Matching[0];$Songs=@($Drive.soundtrack|Where-Object{$_.track}|Select-Object -First 5)
        if(-not$Songs){$Base.answer="I found your latest drive to $($Drive.endingLocation) during $($Range.label), but it has no matched driving tracks.";$Base.evidence=@([ordered]@{type='drive';id=$Drive.id;date=$Drive.dateLabel;miles=$Drive.miles;route="$($Drive.startingLocation) to $($Drive.endingLocation)"});return [pscustomobject]$Base}
        $Base.answer="While driving to $($Drive.endingLocation), you listened to $(@($Songs|ForEach-Object{"$($_.track) by $($_.artist)"})-join'; ').";$Base.evidence=@($Songs|ForEach-Object{[ordered]@{type='track';track=$_.track;artist=$_.artist;playedAt=$_.playedAt;driveId=$Drive.id}});return [pscustomobject]$Base
    }
    if($Normalized-match'\b(how many|times|often)\b.*\b(?:drive|driven|trip)\s+to\s+(.+)$'){$Destination=$Matches[2].Trim();$Matching=@($RecentDrives|Where-Object{("$($_.endingLocation) $($_.rawEndingLocation)".ToLowerInvariant())-like"*$Destination*"});$Base.operation='destination_count';$Base.filters.destination=$Destination;$Base.answer="You recorded $($Matching.Count) drive$($(if($Matching.Count-eq1){''}else{'s'})) to destinations matching $Destination during $($Range.label).";$Base.evidence=@($Matching|Select-Object -First 5|ForEach-Object{[ordered]@{type='drive';id=$_.id;date=$_.dateLabel;miles=$_.miles;route="$($_.startingLocation) to $($_.endingLocation)"}});return [pscustomobject]$Base}
    if($Normalized-match'\b(longest|farthest)\b.*\bdrive\b'){$Drive=@($RecentDrives|Sort-Object{[double]$_.miles}-Descending|Select-Object -First 1);$Base.operation='longest_drive';if(-not$Drive){$Base.answer="I could not find a completed drive during $($Range.label).";return [pscustomobject]$Base};$Item=$Drive[0];$Base.answer="Your longest drive during $($Range.label) was $($Item.miles) miles on $($Item.dateLabel).";$Base.evidence=@([ordered]@{type='drive';id=$Item.id;date=$Item.dateLabel;miles=$Item.miles;route="$($Item.startingLocation) to $($Item.endingLocation)"});return [pscustomobject]$Base}
    if($Normalized-match'\b(best|most efficient)\b.*\b(efficiency|drive)\b'){$Drive=@($RecentDrives|Where-Object{$null-ne$_.efficiencyWhMi-and[double]$_.miles-ge5}|Sort-Object{[double]$_.efficiencyWhMi}|Select-Object -First 1);$Base.operation='best_efficiency';if(-not$Drive){$Base.answer="I could not find a completed drive with enough energy data during $($Range.label).";return [pscustomobject]$Base};$Item=$Drive[0];$Base.answer="Your most efficient drive during $($Range.label) was $($Item.efficiencyWhMi) Wh/mi on $($Item.dateLabel).";$Base.evidence=@([ordered]@{type='drive';id=$Item.id;date=$Item.dateLabel;miles=$Item.miles;efficiencyWhMi=$Item.efficiencyWhMi;route="$($Item.startingLocation) to $($Item.endingLocation)"});return [pscustomobject]$Base}
    if($Normalized-match'\b(average|avg)\b.*\b(efficiency|wh mi)\b'){$Comparable=@($RecentDrives|Where-Object{$null-ne$_.energyKWh-and[double]$_.energyKWh-gt0-and[double]$_.miles-gt0});$Miles=[double](@($Comparable|Measure-Object miles -Sum).Sum);$Energy=[double](@($Comparable|Measure-Object energyKWh -Sum).Sum);$Base.operation='average_efficiency';if($Miles-le0){$Base.answer="I could not find enough driving energy data during $($Range.label).";return [pscustomobject]$Base};$Efficiency=[math]::Round(($Energy*1000)/$Miles);$Base.answer="Your average driving efficiency during $($Range.label) was $Efficiency Wh/mi.";$Base.evidence=@([ordered]@{type='drives';count=$Comparable.Count;miles=[math]::Round($Miles,1);energyKWh=[math]::Round($Energy,1);efficiencyWhMi=$Efficiency});return [pscustomobject]$Base}
    if($Normalized-match'\b(how many|number of|count)\b.*\bdrives?\b'-and$Normalized-notmatch'\b(miles|distance|far)\b'){$Base.operation='drive_count';$Base.answer="You completed $($RecentDrives.Count) drive$($(if($RecentDrives.Count-eq1){''}else{'s'})) during $($Range.label).";$Base.evidence=@([ordered]@{type='drives';count=$RecentDrives.Count});return [pscustomobject]$Base}
    if($Normalized-match'\b(miles|distance|far)\b.*\b(drives?|driven|travel)\b|\b(how far)\b'){$Miles=[math]::Round((@($RecentDrives|Measure-Object miles -Sum).Sum),1);$Base.operation='drive_distance';$Base.answer="You drove $Miles miles during $($Range.label) across $($RecentDrives.Count) completed drives.";$Base.evidence=@([ordered]@{type='drives';miles=$Miles;count=$RecentDrives.Count});return [pscustomobject]$Base}
    if($Normalized-match'\b(most visited|top place|favorite place|where.*go|where.*drive most)\b'){$Top=@($RecentDrives|Where-Object{$_.endingLocation}|Group-Object endingLocation|Sort-Object Count -Descending|Select-Object -First 1);$Base.operation='top_place';if(-not$Top){$Base.answer="I could not find a driving destination during $($Range.label).";return [pscustomobject]$Base};$Base.answer="Your most visited driving destination during $($Range.label) was $($Top[0].Name), with $($Top[0].Count) arrivals.";$Base.evidence=@([ordered]@{type='place';name=$Top[0].Name;uses=$Top[0].Count});return [pscustomobject]$Base}
    if($Normalized-match'\b(top|favorite|most played)\b.*\b(track|song|music)\b'){$Tracks=@($DrivingSongs|Group-Object{"$($_.track)|$($_.artist)"}|Sort-Object Count -Descending|Select-Object -First 3);$Base.operation='top_tracks';if(-not$Tracks){$Base.answer="I could not find any matched driving tracks $DrivingWhen.";return [pscustomobject]$Base};$Name=$Tracks[0].Name-split'\|',2;$Base.answer="Your most-played track while driving $DrivingWhen was $($Name[0]) by $($Name[1]), with $($Tracks[0].Count) plays.";$Base.evidence=@($Tracks|ForEach-Object{$Parts=$_.Name-split'\|',2;[ordered]@{type='track';track=$Parts[0];artist=$Parts[1];plays=$_.Count;scope='while_driving'}});return [pscustomobject]$Base}
    if($Normalized-match'\b(top|favorite|most played)\b.*\bartist\b|\bwho.*listen.*most\b'){$Artists=@($DrivingSongs|Where-Object artist|Group-Object artist|Sort-Object Count -Descending|Select-Object -First 3);$Base.operation='top_artists';if(-not$Artists){$Base.answer="I could not find any matched driving artists $DrivingWhen.";return [pscustomobject]$Base};$Base.answer="Your most-played artist while driving $DrivingWhen was $($Artists[0].Name), with $($Artists[0].Count) plays.";$Base.evidence=@($Artists|ForEach-Object{[ordered]@{type='artist';artist=$_.Name;plays=$_.Count;scope='while_driving'}});return [pscustomobject]$Base}
    if($Normalized-match'\b(last|latest|recent)\b.*\b(song|track|music)\b|\bwhat.*listen.*last\b'){$Latest=@($DrivingSongs|Where-Object track|Sort-Object{try{[DateTimeOffset]::Parse("$($_.playedAt)")}catch{[DateTimeOffset]::MinValue}}-Descending|Select-Object -First 1);$Base.operation='latest_track';if(-not$Latest){$Base.answer="I could not find a matched driving track $DrivingWhen.";return [pscustomobject]$Base};$Item=$Latest[0];$Base.answer="Your latest track while driving $DrivingWhen was $($Item.track) by $($Item.artist).";$Base.evidence=@([ordered]@{type='track';track=$Item.track;artist=$Item.artist;playedAt=$Item.playedAt;driveId=$Item.driveId;scope='while_driving'});return [pscustomobject]$Base}
    if($Normalized-match'\b(charg|charge)\b'){$Base.operation='unsupported';$Base.answer='JourneyDeck search is scoped to what happened while driving, so charging questions are not answered here.';return [pscustomobject]$Base}
    $Base.operation='unsupported';$Base.answer='JourneyDeck search answers only questions about what happened while driving: trips, distance, efficiency, destinations, and drive soundtracks.';return [pscustomobject]$Base
}

Export-ModuleMember -Function Get-DriveOSAssistantAnswer,Get-DriveOSAssistantTimeRange
