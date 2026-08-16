Set-StrictMode -Version 2.0

function ConvertTo-DriveOSYouTubeMusicMatchText {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    return (($Value -replace '[^\p{L}\p{Nd}]','').ToLowerInvariant())
}

function New-DriveOSYouTubeMusicStableId {
    param([Parameter(Mandatory=$true)][string]$ProviderKey)
    $Sha=[Security.Cryptography.SHA256]::Create()
    try {
        $Bytes=[Text.Encoding]::UTF8.GetBytes("journeydeck`0youtube_music_play`0$ProviderKey")
        $Hex=([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
        return "youtube_music|$($Hex.Substring(0,32))"
    }
    finally { $Sha.Dispose() }
}

function ConvertFrom-DriveOSYouTubeMusicDate {
    param([Parameter(Mandatory=$true)][string]$Value)
    $Text=[Net.WebUtility]::HtmlDecode($Value).Replace([char]0x202F,' ').Replace([char]0x00A0,' ').Trim()
    $Offset=[TimeSpan]::FromHours(-5)
    if($Text -match '\s+CST$'){$Offset=[TimeSpan]::FromHours(-6);$Text=$Text -replace '\s+CST$',''}
    elseif($Text -match '\s+CDT$'){$Text=$Text -replace '\s+CDT$',''}
    else{return $null}
    $Local=[DateTime]::MinValue
    if(-not [DateTime]::TryParse($Text,[Globalization.CultureInfo]::GetCultureInfo('en-US'),[Globalization.DateTimeStyles]::AllowWhiteSpaces,[ref]$Local)){return $null}
    return [DateTimeOffset]::new([DateTime]::SpecifyKind($Local,[DateTimeKind]::Unspecified),$Offset)
}

function ConvertFrom-DriveOSYouTubeMusicTakeoutHtml {
    param([Parameter(Mandatory=$true)][string]$Html)
    $Records=New-Object Collections.ArrayList
    $Seen=@{}
    $Blocks=[regex]::Matches($Html,'(?s)<div class="outer-cell.*?(?=<div class="outer-cell|</body>)')
    foreach($Block in $Blocks){
        $Header=[regex]::Match($Block.Value,'(?s)<p class="mdl-typography--title">(.*?)<br')
        $Product=[Net.WebUtility]::HtmlDecode(([regex]::Replace($Header.Groups[1].Value,'<[^>]+>',''))).Trim()
        if($Product -ne 'YouTube Music'){continue}
        $Match=[regex]::Match($Block.Value,'(?s)Watched.*?<a href="(?<url>[^"]+)">(?<title>.*?)</a><br>(?:<a href="[^"]+">(?<channel>.*?)</a><br>)?(?<date>[^<]+)<br>')
        if(-not $Match.Success){continue}
        $Title=[Net.WebUtility]::HtmlDecode(([regex]::Replace($Match.Groups['title'].Value,'<[^>]+>',''))).Trim()
        $Artist=[Net.WebUtility]::HtmlDecode(([regex]::Replace($Match.Groups['channel'].Value,'<[^>]+>',''))).Trim() -replace '\s+-\s+Topic$',''
        $PlayedAt=ConvertFrom-DriveOSYouTubeMusicDate $Match.Groups['date'].Value
        if(-not $Title -or -not $PlayedAt){continue}
        $Url=[Net.WebUtility]::HtmlDecode($Match.Groups['url'].Value)
        $VideoId=if($Url -match '[?&]v=([^&]+)'){$Matches[1]}else{$Url}
        $ProviderKey="$VideoId|$($PlayedAt.ToUnixTimeSeconds())"
        if($Seen.ContainsKey($ProviderKey)){continue}
        $Seen[$ProviderKey]=$true
        [void]$Records.Add([PSCustomObject]@{
            id=New-DriveOSYouTubeMusicStableId -ProviderKey $ProviderKey
            source='youtube_music';played_at=$PlayedAt.ToUniversalTime().ToString('o');duration_ms=0
            track=$Title;artist=$Artist;album=$null;track_id=$null;track_uri=$null
            album_image=$null;spotify_url=$null;album_spotify_url=$null
            youtube_url=$Url;youtube_video_id=$VideoId
        })
    }
    return @($Records)
}

function Get-DriveOSYouTubeMusicDriveWindow {
    param([Parameter(Mandatory=$true)]$Drive)
    $Start=$Drive.PSObject.Properties['started_at'].Value
    $End=$Drive.PSObject.Properties['ended_at'].Value
    if($null -eq $Start -and $Drive.PSObject.Properties['startedAtEpoch']){$Start=$Drive.startedAtEpoch}
    if($null -eq $End -and $Drive.PSObject.Properties['endedAtEpoch']){$End=$Drive.endedAtEpoch}
    if(-not $Start -or -not $End -or [long]$End -le [long]$Start){return $null}
    return [PSCustomObject]@{driveId="$Start-$End";startedAt=[DateTimeOffset]::FromUnixTimeSeconds([long]$Start);endedAt=[DateTimeOffset]::FromUnixTimeSeconds([long]$End)}
}

function Test-DriveOSYouTubeMusicSameListen {
    param($Candidate,$Existing)
    $Track=ConvertTo-DriveOSYouTubeMusicMatchText "$($Candidate.track)"
    if(-not $Track -or $Track -ne (ConvertTo-DriveOSYouTubeMusicMatchText "$($Existing.track)")){return $false}
    $Artist=ConvertTo-DriveOSYouTubeMusicMatchText "$($Candidate.artist)"
    $ExistingArtist=ConvertTo-DriveOSYouTubeMusicMatchText "$($Existing.artist)"
    if($Artist -and $ExistingArtist -and $Artist -ne $ExistingArtist -and -not $Artist.Contains($ExistingArtist) -and -not $ExistingArtist.Contains($Artist)){return $false}
    try{return [Math]::Abs(([DateTimeOffset]::Parse("$($Candidate.played_at)")-[DateTimeOffset]::Parse("$($Existing.played_at)")).TotalSeconds) -le 720}catch{return $false}
}

function ConvertTo-DriveOSYouTubeMusicSoundtrackSong {
    param($Record)
    $Local=[DateTimeOffset]::Parse("$($Record.played_at)").ToLocalTime()
    return [PSCustomObject]@{
        playedAt=$Local.ToString('o');time=$Local.ToString('h:mm tt');track=$Record.track;artist=$Record.artist;album=$null
        trackId=$null;trackUri=$null;durationMs=0;albumImage=$null;spotifyUrl=$null;albumSpotifyUrl=$null
        youtubeUrl=$Record.youtube_url;source='youtube_music'
    }
}

function New-DriveOSYouTubeMusicImportPlan {
    param(
        [Parameter(Mandatory=$true)][object[]]$Records,
        [Parameter(Mandatory=$true)][object[]]$Drives,
        [object[]]$ExistingHistory=@(),[object[]]$ExistingSoundtracks=@(),
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFromUtc,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [ValidateRange(0,15)][int]$BoundaryReviewMinutes=5,
        [switch]$IncludeBoundaryMatches
    )
    $Windows=@($Drives|ForEach-Object{Get-DriveOSYouTubeMusicDriveWindow $_}|Where-Object{$null-ne$_})
    $SoundtrackMap=@{};foreach($Item in $ExistingSoundtracks){if($Item.driveId){$SoundtrackMap["$($Item.driveId)"]=$Item}}
    $HistoryRecords=New-Object Collections.ArrayList;$ByDrive=@{};$Outside=0;$ExistingDuplicates=0;$AlreadyImported=0;$NoMatch=0;$Ambiguous=0;$Direct=0;$Boundary=0
    $Tolerance=[TimeSpan]::FromMinutes($BoundaryReviewMinutes)
    foreach($Record in $Records){
        $PlayedAt=[DateTimeOffset]::Parse("$($Record.played_at)")
        if($PlayedAt-lt$RangeFromUtc.ToUniversalTime()-or$PlayedAt-gt$RangeToUtc.ToUniversalTime()){$Outside++;continue}
        $ExactExisting=$false;$CrossProviderDuplicate=$false
        foreach($Existing in $ExistingHistory){
            if("$($Existing.id)"-eq"$($Record.id)"){$ExactExisting=$true;continue}
            $ExistingSource=if($Existing.PSObject.Properties['source']-and$Existing.source){"$($Existing.source)".ToLowerInvariant()}else{'spotify'}
            if($ExistingSource-ne'youtube_music'-and(Test-DriveOSYouTubeMusicSameListen $Record $Existing)){$CrossProviderDuplicate=$true;break}
        }
        if($CrossProviderDuplicate){$ExistingDuplicates++;continue}
        if($ExactExisting){$AlreadyImported++}
        $Candidates=@($Windows|Where-Object{$PlayedAt-ge$_.startedAt.Subtract($Tolerance)-and$PlayedAt-le$_.endedAt.Add($Tolerance)})
        if($Candidates.Count-eq0){$NoMatch++;continue};if($Candidates.Count-ne1){$Ambiguous++;continue}
        $Window=$Candidates[0];$IsDirect=$PlayedAt-ge$Window.startedAt-and$PlayedAt-le$Window.endedAt
        if($IsDirect){$Direct++}else{$Boundary++;if(-not$IncludeBoundaryMatches){continue}}
        if(-not$ExactExisting){[void]$HistoryRecords.Add($Record)}
        if(-not$ByDrive.ContainsKey($Window.driveId)){$ByDrive[$Window.driveId]=New-Object Collections.ArrayList};[void]$ByDrive[$Window.driveId].Add($Record)
    }
    $SoundtrackRecords=New-Object Collections.ArrayList
    foreach($DriveId in @($ByDrive.Keys|Sort-Object)){
        $Window=@($Windows|Where-Object driveId -eq $DriveId)[0];$Existing=if($SoundtrackMap.ContainsKey($DriveId)){$SoundtrackMap[$DriveId]}else{$null};$Songs=New-Object Collections.ArrayList
        if($Existing){foreach($Song in @($Existing.songs|Where-Object{$null-ne$_})){[void]$Songs.Add($Song)}}
        foreach($Record in $ByDrive[$DriveId]){
            $Candidate=ConvertTo-DriveOSYouTubeMusicSoundtrackSong $Record
            $SongDuplicate=@($Songs|Where-Object{
                try{
                    (ConvertTo-DriveOSYouTubeMusicMatchText "$($_.track)")-eq(ConvertTo-DriveOSYouTubeMusicMatchText "$($Candidate.track)")-and
                    (ConvertTo-DriveOSYouTubeMusicMatchText "$($_.artist)")-eq(ConvertTo-DriveOSYouTubeMusicMatchText "$($Candidate.artist)")-and
                    [Math]::Abs(([DateTimeOffset]::Parse("$($_.playedAt)")-[DateTimeOffset]::Parse("$($Candidate.playedAt)")).TotalSeconds)-le5
                }catch{$false}
            }).Count-gt0
            if(-not$SongDuplicate){[void]$Songs.Add($Candidate)}
        }
        $Sorted=@($Songs|Sort-Object{try{[DateTimeOffset]::Parse("$($_.playedAt)")}catch{[DateTimeOffset]::MinValue}})
        $Top=@($Sorted|Where-Object artist|Group-Object artist|Sort-Object @{Expression='Count';Descending=$true},@{Expression='Name';Descending=$false}|Select-Object -First 1|ForEach-Object Name)[0]
        [void]$SoundtrackRecords.Add([PSCustomObject]@{version=1;driveId=$DriveId;startedAt=$Window.startedAt.ToString('o');endedAt=$Window.endedAt.ToString('o');status='finalized';songCount=$Sorted.Count;topArtist=$Top;songs=$Sorted;sourceLatestPlayedAt=@($ByDrive[$DriveId]|Sort-Object played_at -Descending|Select-Object -First 1|ForEach-Object played_at)[0];calculatedAt=[DateTimeOffset]::UtcNow.ToString('o')})
    }
    return [PSCustomObject]@{rangeFromUtc=$RangeFromUtc.ToUniversalTime().ToString('o');rangeToUtc=$RangeToUtc.ToUniversalTime().ToString('o');recordsSeen=$Records.Count;outsideRange=$Outside;existingDuplicates=$ExistingDuplicates;alreadyImported=$AlreadyImported;noDriveMatch=$NoMatch;ambiguousMatches=$Ambiguous;directMatches=$Direct;boundaryReviewMatches=$Boundary;matchedPlays=@($ByDrive.Values|ForEach-Object{$_}).Count;newHistoryRecords=$HistoryRecords.Count;affectedDrives=$SoundtrackRecords.Count;historyRecords=@($HistoryRecords);soundtrackRecords=@($SoundtrackRecords)}
}

Export-ModuleMember -Function ConvertFrom-DriveOSYouTubeMusicTakeoutHtml,New-DriveOSYouTubeMusicImportPlan
