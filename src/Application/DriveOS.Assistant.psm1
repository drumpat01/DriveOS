function Get-DriveOSAssistantWindowDays {
    param([string]$Question)

    $Text = "$Question".ToLowerInvariant()
    if ($Text -match '\b(today|today s)\b') { return 1 }
    if ($Text -match '\b(week|7 days|seven days)\b') { return 7 }
    if ($Text -match '\b(14 days|two weeks)\b') { return 14 }
    if ($Text -match '\b(month|30 days|thirty days)\b') { return 30 }
    if ($Text -match '\b(year|365 days)\b') { return 365 }
    return 30
}

function Get-DriveOSAssistantAnswer {
    param(
        [Parameter(Mandatory=$true)][string]$Question,
        [object[]]$Drives=@(),
        [object[]]$History=@(),
        [object[]]$Places=@(),
        [object[]]$Charges=@()
    )

    $Text = "$Question".Trim()
    if ($Text.Length -lt 3 -or $Text.Length -gt 500) { throw 'Ask a question between 3 and 500 characters.' }
    $Normalized = ($Text.ToLowerInvariant() -replace '[^a-z0-9]+',' ').Trim()
    $Days = Get-DriveOSAssistantWindowDays -Question $Text
    $Cutoff = [DateTimeOffset]::Now.AddDays(-$Days)
    $RecentDrives = @($Drives | Where-Object { try { [DateTimeOffset]::Parse("$($_.startedAt)") -ge $Cutoff } catch { $false } })

    $Base = [ordered]@{
        question = $Text
        filters = [ordered]@{ periodDays = $Days; timezone = 'America/Chicago' }
        evidence = @()
        suggestions = @('How many miles did I drive this month?','What was my longest drive?','Who is my top artist?','What is my most visited place?')
    }

    if ($Normalized -match '\b(listen|song|music|track)\b.*\b(?:drive|trip)\s+to\s+(.+)$') {
        $Destination=$Matches[2].Trim()
        $Matching=@($Drives|Where-Object{("$($_.endingLocation) $($_.rawEndingLocation)".ToLowerInvariant()) -like "*$Destination*"}|Sort-Object{try{[DateTimeOffset]::Parse("$($_.startedAt)")}catch{[DateTimeOffset]::MinValue}} -Descending)
        if(-not $Matching){$Base.operation='drive_music';$Base.answer="I could not find a recorded drive to $Destination.";$Base.filters.destination=$Destination;return [pscustomobject]$Base}
        $Drive=$Matching[0];$Songs=@($Drive.soundtrack|Where-Object{$_.track}|Select-Object -First 5)
        $Base.operation='drive_music';$Base.filters.destination=$Destination
        if(-not $Songs){$Base.answer="I found your latest drive to $($Drive.endingLocation), but it has no matched Spotify tracks.";$Base.evidence=@([ordered]@{type='drive';id=$Drive.id;date=$Drive.dateLabel;miles=$Drive.miles;route="$($Drive.startingLocation) to $($Drive.endingLocation)"});return [pscustomobject]$Base}
        $Base.answer="On your latest drive to $($Drive.endingLocation), you listened to $(@($Songs|ForEach-Object{"$($_.track) by $($_.artist)"}) -join '; ')."
        $Base.evidence=@($Songs|ForEach-Object{[ordered]@{type='track';track=$_.track;artist=$_.artist;playedAt=$_.playedAt;driveId=$Drive.id}})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(how many|times|often)\b.*\b(?:drive|driven|trip)\s+to\s+(.+)$') {
        $Destination=$Matches[2].Trim()
        $Matching=@($Drives|Where-Object{("$($_.endingLocation) $($_.rawEndingLocation)".ToLowerInvariant()) -like "*$Destination*"})
        $Base.operation='destination_count';$Base.filters.destination=$Destination
        $Base.answer="You have $($Matching.Count) recorded drive$($(if($Matching.Count -eq 1){''}else{'s'})) to destinations matching $Destination."
        $Base.evidence=@($Matching|Sort-Object{try{[DateTimeOffset]::Parse("$($_.startedAt)")}catch{[DateTimeOffset]::MinValue}} -Descending|Select-Object -First 5|ForEach-Object{[ordered]@{type='drive';id=$_.id;date=$_.dateLabel;miles=$_.miles;route="$($_.startingLocation) to $($_.endingLocation)"}})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(longest|farthest)\b.*\bdrive\b') {
        $Drive = @($Drives | Sort-Object { [double]($_.miles) } -Descending | Select-Object -First 1)
        if (-not $Drive) { $Base.answer = 'I could not find any completed drives yet.'; $Base.operation = 'longest_drive'; return [pscustomobject]$Base }
        $Item = $Drive[0]
        $Base.operation = 'longest_drive'; $Base.answer = "Your longest recorded drive was $($Item.miles) miles on $($Item.dateLabel)."
        $Base.evidence = @([ordered]@{ type='drive'; id=$Item.id; date=$Item.dateLabel; miles=$Item.miles; route="$($Item.startingLocation) to $($Item.endingLocation)" })
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(best|most efficient)\b.*\b(efficiency|drive)\b') {
        $Drive = @($Drives | Where-Object { $null -ne $_.efficiencyWhMi -and [double]$_.miles -ge 5 } | Sort-Object { [double]$_.efficiencyWhMi } | Select-Object -First 1)
        if (-not $Drive) { $Base.answer = 'I could not find a completed drive with enough energy data to compare.'; $Base.operation = 'best_efficiency'; return [pscustomobject]$Base }
        $Item=$Drive[0]; $Base.operation='best_efficiency'; $Base.answer = "Your most efficient recorded drive was $($Item.efficiencyWhMi) Wh/mi on $($Item.dateLabel)."
        $Base.evidence=@([ordered]@{ type='drive'; id=$Item.id; date=$Item.dateLabel; miles=$Item.miles; efficiencyWhMi=$Item.efficiencyWhMi; route="$($Item.startingLocation) to $($Item.endingLocation)" })
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(average|avg)\b.*\b(efficiency|wh mi)\b') {
        $Comparable=@($RecentDrives|Where-Object{$null -ne $_.energyKWh -and [double]$_.energyKWh -gt 0 -and [double]$_.miles -gt 0})
        $Miles=[double](@($Comparable|Measure-Object -Property miles -Sum).Sum)
        $Energy=[double](@($Comparable|Measure-Object -Property energyKWh -Sum).Sum)
        if($Miles -le 0){$Base.answer='I could not find enough energy data to calculate average efficiency.';$Base.operation='average_efficiency';return [pscustomobject]$Base}
        $Efficiency=[math]::Round(($Energy*1000)/$Miles)
        $Base.operation='average_efficiency';$Base.answer="Your average efficiency was $Efficiency Wh/mi over the last $Days days."
        $Base.evidence=@([ordered]@{type='drives';count=$Comparable.Count;miles=[math]::Round($Miles,1);energyKWh=[math]::Round($Energy,1);efficiencyWhMi=$Efficiency;periodDays=$Days})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(how many|number of|count)\b.*\bdrives?\b' -and $Normalized -notmatch '\b(miles|distance|far)\b') {
        $Base.operation='drive_count'; $Base.answer = "You completed $($RecentDrives.Count) drive$($(if($RecentDrives.Count -eq 1){''}else{'s'})) in the last $Days days."
        $Base.evidence=@([ordered]@{ type='drives'; count=$RecentDrives.Count; periodDays=$Days })
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(miles|distance|far)\b.*\b(drives?|driven|travel)\b|\b(how far)\b') {
        $Miles=[math]::Round((@($RecentDrives | Measure-Object -Property miles -Sum).Sum),1)
        $Base.operation='drive_distance'; $Base.answer = "You drove $Miles miles in the last $Days days across $($RecentDrives.Count) completed drives."
        $Base.evidence=@([ordered]@{ type='drives'; miles=$Miles; count=$RecentDrives.Count; periodDays=$Days })
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(most visited|top place|favorite place|where.*go)\b') {
        $Place=@($Places | Sort-Object { [int]($_.uses) } -Descending | Select-Object -First 1)
        if (-not $Place) { $Base.answer='I could not find any saved drive places yet.'; $Base.operation='top_place'; return [pscustomobject]$Base }
        $Item=$Place[0]; $Base.operation='top_place'; $Base.answer = "Your most visited recorded place is $($Item.displayName), with $($Item.uses) drive endpoints."
        $Base.evidence=@([ordered]@{ type='place'; name=$Item.displayName; uses=$Item.uses; category=$Item.businessCategory })
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(top|favorite|most played)\b.*\b(track|song|music)\b') {
        $Tracks=@{}
        foreach($Record in $History){$Key=("$($Record.track)|$($Record.artist)").Trim('|'); if(-not $Key){continue}; if(-not $Tracks.ContainsKey($Key)){$Tracks[$Key]=0};$Tracks[$Key]++}
        $Top=@($Tracks.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 3)
        if(-not $Top){$Base.answer='I could not find Spotify history yet.';$Base.operation='top_tracks';return [pscustomobject]$Base}
        $Names=@($Top|ForEach-Object{$_.Key -replace '\|',' by '})
        $Base.operation='top_tracks';$Base.answer="Your most-played tracks are $($Names -join '; ')."
        $Base.evidence=@($Top|ForEach-Object{[ordered]@{type='track';track=($_.Key -split '\|')[0];artist=($_.Key -split '\|')[1];plays=$_.Value}})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(top|favorite|most played)\b.*\bartist\b|\bwho.*listen.*most\b') {
        $Artists=@{}
        foreach($Record in $History){$Artist="$($Record.artist)".Trim();if(-not $Artist){continue};if(-not $Artists.ContainsKey($Artist)){$Artists[$Artist]=0};$Artists[$Artist]++}
        $Top=@($Artists.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 3)
        if(-not $Top){$Base.answer='I could not find Spotify history yet.';$Base.operation='top_artists';return [pscustomobject]$Base}
        $Base.operation='top_artists';$Base.answer="Your most-played artist is $($Top[0].Key), with $($Top[0].Value) archived plays."
        $Base.evidence=@($Top|ForEach-Object{[ordered]@{type='artist';artist=$_.Key;plays=$_.Value}})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(last|latest|recent)\b.*\b(song|track|music)\b|\bwhat.*listen.*last\b') {
        $Latest=@($History|Where-Object{$_.track}|Sort-Object{try{[DateTimeOffset]::Parse("$($_.playedAt)")}catch{[DateTimeOffset]::MinValue}} -Descending|Select-Object -First 1)
        if(-not $Latest){$Base.answer='I could not find Spotify history yet.';$Base.operation='latest_track';return [pscustomobject]$Base}
        $Item=$Latest[0];$Base.operation='latest_track';$Base.answer="Your latest archived track is $($Item.track) by $($Item.artist)."
        $Base.evidence=@([ordered]@{type='track';track=$Item.track;artist=$Item.artist;playedAt=$Item.playedAt;source=$Item.source})
        return [pscustomobject]$Base
    }

    if ($Normalized -match '\b(charg|charge)\b') {
        $Recent=@($Charges|Where-Object{try{[DateTimeOffset]::Parse("$($_.startedAt)") -ge $Cutoff}catch{$false}})
        $Energy=[math]::Round((@($Recent|Measure-Object -Property energyAddedKWh -Sum).Sum),1)
        $Base.operation='charging_summary';$Base.answer="You had $($Recent.Count) charging session$($(if($Recent.Count -eq 1){''}else{'s'})) in the last $Days days, adding $Energy kWh."
        $Base.evidence=@([ordered]@{type='charging';sessions=$Recent.Count;energyAddedKWh=$Energy;periodDays=$Days})
        return [pscustomobject]$Base
    }

    $Base.operation='unsupported';$Base.answer='I can currently answer questions about drive distance and count, destinations, music on a drive, longest drive, average or best efficiency, top tracks and artists, your latest track, most-visited places, and charging totals. Try one of the suggested questions.'
    return [pscustomobject]$Base
}

Export-ModuleMember -Function Get-DriveOSAssistantAnswer
