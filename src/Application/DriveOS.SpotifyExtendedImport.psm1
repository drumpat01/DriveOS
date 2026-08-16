Set-StrictMode -Version 2.0

function Get-DriveOSSpotifyExtendedValue {
    param([AllowNull()]$Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function ConvertTo-DriveOSSpotifyExtendedMatchText {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    return (($Value -replace '[^\p{L}\p{Nd}]','').ToLowerInvariant())
}

function ConvertTo-DriveOSSpotifyExtendedSafeText {
    param([AllowNull()]$Value)
    if ($null -eq $Value) { return '' }
    # Turso's HTTP SQL endpoint rejects JSON strings containing UTF-16
    # surrogate escapes. Preserve BMP text and omit decorative supplementary
    # characters from imported metadata rather than aborting the resumable run.
    return ("$Value" -replace '[\uD800-\uDFFF]','').Trim()
}

function Get-DriveOSSpotifyExtendedSource {
    param([AllowNull()]$Record)
    $Source = "$(Get-DriveOSSpotifyExtendedValue $Record 'source')".ToLowerInvariant()
    if ($Source) { return $Source }
    $Id = "$(Get-DriveOSSpotifyExtendedValue $Record 'id')"
    if ($Id -like 'youtube_music|*') { return 'youtube_music' }
    if ($Id -like 'lastfm|*') { return 'lastfm' }
    return 'spotify'
}

function ConvertTo-DriveOSSpotifyExtendedRecord {
    param([Parameter(Mandatory=$true)]$Entry)

    $Uri = "$(Get-DriveOSSpotifyExtendedValue $Entry 'spotify_track_uri')".Trim()
    $Track = ConvertTo-DriveOSSpotifyExtendedSafeText (Get-DriveOSSpotifyExtendedValue $Entry 'master_metadata_track_name')
    $Artist = ConvertTo-DriveOSSpotifyExtendedSafeText (Get-DriveOSSpotifyExtendedValue $Entry 'master_metadata_album_artist_name')
    $EndedAtText = "$(Get-DriveOSSpotifyExtendedValue $Entry 'ts')".Trim()
    $PlayedMs = Get-DriveOSSpotifyExtendedValue $Entry 'ms_played'
    if ($Uri -notlike 'spotify:track:*' -or -not $Track -or -not $Artist -or -not $EndedAtText -or $null -eq $PlayedMs) { return $null }

    try {
        $EndedAt = [DateTimeOffset]::Parse($EndedAtText).ToUniversalTime()
        $PlayedMs = [long]$PlayedMs
    }
    catch { return $null }
    if ($PlayedMs -le 0) { return $null }

    $StartedAt = $EndedAt.AddMilliseconds(-$PlayedMs)
    $TrackId = $Uri.Substring('spotify:track:'.Length)
    $PlayedAt = $StartedAt.ToString('yyyy-MM-ddTHH:mm:ss.fffZ',[Globalization.CultureInfo]::InvariantCulture)
    return [PSCustomObject]@{
        id = "$TrackId|$PlayedAt"
        source = 'spotify'
        played_at = $PlayedAt
        playback_ended_at = $EndedAt.ToString('o')
        duration_ms = $PlayedMs
        track_id = $TrackId
        track_uri = $Uri
        track = $Track
        artist = $Artist
        album = ConvertTo-DriveOSSpotifyExtendedSafeText (Get-DriveOSSpotifyExtendedValue $Entry 'master_metadata_album_album_name')
        album_image = $null
        spotify_url = "https://open.spotify.com/track/$TrackId"
        album_spotify_url = $null
        import_source = 'spotify_extended_history'
    }
}

function Get-DriveOSSpotifyExtendedDriveWindow {
    param([Parameter(Mandatory=$true)]$Drive)
    $Start = Get-DriveOSSpotifyExtendedValue $Drive 'started_at'
    $End = Get-DriveOSSpotifyExtendedValue $Drive 'ended_at'
    if ($null -eq $Start) { $Start = Get-DriveOSSpotifyExtendedValue $Drive 'startedAtEpoch' }
    if ($null -eq $End) { $End = Get-DriveOSSpotifyExtendedValue $Drive 'endedAtEpoch' }
    if (-not $Start -or -not $End -or [long]$End -le [long]$Start) { return $null }
    return [PSCustomObject]@{
        driveId = "$Start-$End"
        startedAt = [DateTimeOffset]::FromUnixTimeSeconds([long]$Start)
        endedAt = [DateTimeOffset]::FromUnixTimeSeconds([long]$End)
    }
}

function Test-DriveOSSpotifyExtendedSameListen {
    param([Parameter(Mandatory=$true)]$Candidate,[Parameter(Mandatory=$true)]$Existing)
    if ((ConvertTo-DriveOSSpotifyExtendedMatchText "$(Get-DriveOSSpotifyExtendedValue $Candidate 'track')") -ne
        (ConvertTo-DriveOSSpotifyExtendedMatchText "$(Get-DriveOSSpotifyExtendedValue $Existing 'track')")) { return $false }
    $Artist = ConvertTo-DriveOSSpotifyExtendedMatchText "$(Get-DriveOSSpotifyExtendedValue $Candidate 'artist')"
    $ExistingArtist = ConvertTo-DriveOSSpotifyExtendedMatchText "$(Get-DriveOSSpotifyExtendedValue $Existing 'artist')"
    if ($Artist -and $ExistingArtist -and $Artist -ne $ExistingArtist -and -not $Artist.Contains($ExistingArtist) -and -not $ExistingArtist.Contains($Artist)) { return $false }
    try {
        $CandidateTime = [DateTimeOffset]::Parse("$(Get-DriveOSSpotifyExtendedValue $Candidate 'played_at')")
        $ExistingTime = [DateTimeOffset]::Parse("$(Get-DriveOSSpotifyExtendedValue $Existing 'played_at')")
    }
    catch { return $false }
    $DurationSeconds = 240
    foreach ($Item in @($Candidate,$Existing)) {
        $Duration = Get-DriveOSSpotifyExtendedValue $Item 'duration_ms'
        if ($Duration -and [long]$Duration -gt 0) { $DurationSeconds = [Math]::Max($DurationSeconds,[Math]::Ceiling([double]$Duration / 1000)) }
    }
    $WindowSeconds = [Math]::Min([Math]::Max($DurationSeconds + 90,180),720)
    return [Math]::Abs(($CandidateTime - $ExistingTime).TotalSeconds) -le $WindowSeconds
}

function ConvertTo-DriveOSSpotifyExtendedSoundtrackSong {
    param([Parameter(Mandatory=$true)]$Record)
    $Local = [DateTimeOffset]::Parse("$($Record.played_at)").ToLocalTime()
    return [PSCustomObject]@{
        playedAt = $Local.ToString('o'); time = $Local.ToString('h:mm tt')
        track = $Record.track; artist = $Record.artist; album = $Record.album
        trackId = $Record.track_id; trackUri = $Record.track_uri; durationMs = $Record.duration_ms
        albumImage = $null; spotifyUrl = $Record.spotify_url; albumSpotifyUrl = $null; source = 'spotify'
    }
}

function New-DriveOSSpotifyExtendedImportPlan {
    param(
        [Parameter(Mandatory=$true)][object[]]$Entries,
        [Parameter(Mandatory=$true)][object[]]$Drives,
        [object[]]$ExistingHistory=@(),[object[]]$ExistingSoundtracks=@(),
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFromUtc,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [ValidateRange(1000,300000)][long]$MinimumPlayedMs=30000,
        [ValidateRange(1000,300000)][long]$MinimumDriveOverlapMs=15000
    )
    $Windows = @($Drives | ForEach-Object { Get-DriveOSSpotifyExtendedDriveWindow $_ } | Where-Object { $null -ne $_ })
    $WindowsByDay = @{}
    foreach ($Window in $Windows) {
        $Day = $Window.startedAt.UtcDateTime.Date
        $LastDay = $Window.endedAt.UtcDateTime.Date
        while ($Day -le $LastDay) {
            $Key = $Day.ToString('yyyy-MM-dd')
            if (-not $WindowsByDay.ContainsKey($Key)) { $WindowsByDay[$Key] = New-Object Collections.ArrayList }
            [void]$WindowsByDay[$Key].Add($Window)
            $Day = $Day.AddDays(1)
        }
    }
    $SoundtrackMap = @{}; foreach ($Item in $ExistingSoundtracks) { if ($Item.driveId) { $SoundtrackMap["$($Item.driveId)"] = $Item } }
    $HistoryById = @{}; $SpotifyHistoryByTrackId = @{}; $AlternateHistoryByTrack = @{}
    foreach ($Item in $ExistingHistory) {
        if ($Item.id) { $HistoryById["$($Item.id)"] = $Item }
        if ((Get-DriveOSSpotifyExtendedSource $Item) -eq 'spotify') {
            $TrackId = "$(Get-DriveOSSpotifyExtendedValue $Item 'track_id')"
            if ($TrackId) {
                if (-not $SpotifyHistoryByTrackId.ContainsKey($TrackId)) { $SpotifyHistoryByTrackId[$TrackId] = New-Object Collections.ArrayList }
                [void]$SpotifyHistoryByTrackId[$TrackId].Add($Item)
            }
            continue
        }
        $TrackKey = ConvertTo-DriveOSSpotifyExtendedMatchText "$(Get-DriveOSSpotifyExtendedValue $Item 'track')"
        if (-not $TrackKey) { continue }
        if (-not $AlternateHistoryByTrack.ContainsKey($TrackKey)) { $AlternateHistoryByTrack[$TrackKey] = New-Object Collections.ArrayList }
        [void]$AlternateHistoryByTrack[$TrackKey].Add($Item)
    }
    $HistoryRecords = New-Object Collections.ArrayList; $ByDrive = @{}; $SeenIds = @{}
    $Invalid=0; $Outside=0; $Short=0; $Exact=0; $CrossProvider=0; $NoMatch=0; $Ambiguous=0

    foreach ($Entry in $Entries) {
        $Record = ConvertTo-DriveOSSpotifyExtendedRecord $Entry
        if (-not $Record) { $Invalid++; continue }
        $Start = [DateTimeOffset]::Parse($Record.played_at).ToUniversalTime()
        $End = [DateTimeOffset]::Parse($Record.playback_ended_at).ToUniversalTime()
        if ($End -lt $RangeFromUtc.ToUniversalTime() -or $Start -gt $RangeToUtc.ToUniversalTime()) { $Outside++; continue }
        if ([long]$Record.duration_ms -lt $MinimumPlayedMs) { $Short++; continue }
        if ($SeenIds.ContainsKey($Record.id)) { $Exact++; continue }; $SeenIds[$Record.id]=$true

        $CandidateWindows = @{}; $Day = $Start.UtcDateTime.Date; $LastDay = $End.UtcDateTime.Date
        while ($Day -le $LastDay) {
            $Key = $Day.ToString('yyyy-MM-dd')
            if ($WindowsByDay.ContainsKey($Key)) { foreach ($Window in $WindowsByDay[$Key]) { $CandidateWindows[$Window.driveId] = $Window } }
            $Day = $Day.AddDays(1)
        }
        $Candidates = New-Object Collections.ArrayList
        foreach ($Window in $CandidateWindows.Values) {
            $OverlapStart = if ($Start -gt $Window.startedAt) { $Start } else { $Window.startedAt }
            $OverlapEnd = if ($End -lt $Window.endedAt) { $End } else { $Window.endedAt }
            if (($OverlapEnd-$OverlapStart).TotalMilliseconds -ge $MinimumDriveOverlapMs) { [void]$Candidates.Add($Window) }
        }
        if ($Candidates.Count -eq 0) { $NoMatch++; continue }
        if ($Candidates.Count -ne 1) { $Ambiguous++; continue }
        $Window = $Candidates[0]

        $ExistingSpotify = if ($HistoryById.ContainsKey($Record.id)) { $HistoryById[$Record.id] } else { $null }
        if (-not $ExistingSpotify -and $SpotifyHistoryByTrackId.ContainsKey($Record.track_id)) {
            $ExistingSpotify = @($SpotifyHistoryByTrackId[$Record.track_id] | Where-Object {
                try { [Math]::Abs(([DateTimeOffset]::Parse("$($_.played_at)")-$Start).TotalSeconds) -le 5 } catch { $false }
            } | Select-Object -First 1)[0]
        }
        if ($ExistingSpotify) { $Exact++; $ProjectionRecord=$ExistingSpotify } else { [void]$HistoryRecords.Add($Record); $ProjectionRecord=$Record }
        $TrackKey = ConvertTo-DriveOSSpotifyExtendedMatchText $Record.track
        if ($AlternateHistoryByTrack.ContainsKey($TrackKey)) {
            foreach ($Existing in $AlternateHistoryByTrack[$TrackKey]) {
                if (Test-DriveOSSpotifyExtendedSameListen $Record $Existing) { $CrossProvider++; break }
            }
        }
        if (-not $ByDrive.ContainsKey($Window.driveId)) { $ByDrive[$Window.driveId] = New-Object Collections.ArrayList }
        [void]$ByDrive[$Window.driveId].Add($ProjectionRecord)
    }

    $SoundtrackRecords = New-Object Collections.ArrayList
    foreach ($DriveId in @($ByDrive.Keys | Sort-Object)) {
        $Window = @($Windows | Where-Object driveId -eq $DriveId)[0]
        $Songs = New-Object Collections.ArrayList
        if ($SoundtrackMap.ContainsKey($DriveId)) { foreach ($Song in @($SoundtrackMap[$DriveId].songs)) { if ($null -ne $Song) { [void]$Songs.Add($Song) } } }
        foreach ($Record in $ByDrive[$DriveId]) {
            $NearestIndex=-1; $NearestSeconds=[double]::MaxValue
            for ($Index=0; $Index -lt $Songs.Count; $Index++) {
                $Song=$Songs[$Index]
                if ((Get-DriveOSSpotifyExtendedSource $Song) -eq 'spotify') { continue }
                $Comparable=[PSCustomObject]@{track=$Song.track;artist=$Song.artist;played_at=$Song.playedAt;duration_ms=$Song.durationMs}
                if (Test-DriveOSSpotifyExtendedSameListen $Record $Comparable) {
                    $Seconds=[Math]::Abs(([DateTimeOffset]::Parse($Record.played_at)-[DateTimeOffset]::Parse("$($Song.playedAt)")).TotalSeconds)
                    if ($Seconds -lt $NearestSeconds) { $NearestSeconds=$Seconds; $NearestIndex=$Index }
                }
            }
            if ($NearestIndex -ge 0) { $Songs.RemoveAt($NearestIndex) }
            $AlreadyProjected=@($Songs | Where-Object {
                (Get-DriveOSSpotifyExtendedSource $_) -eq 'spotify' -and "$($_.trackId)" -eq "$($Record.track_id)" -and
                $(try {[Math]::Abs(([DateTimeOffset]::Parse("$($_.playedAt)")-[DateTimeOffset]::Parse($Record.played_at)).TotalSeconds)-le5}catch{$false})
            }).Count -gt 0
            if (-not $AlreadyProjected) { [void]$Songs.Add((ConvertTo-DriveOSSpotifyExtendedSoundtrackSong $Record)) }
        }
        $Sorted=@($Songs | Sort-Object { try {[DateTimeOffset]::Parse("$($_.playedAt)")}catch{[DateTimeOffset]::MinValue} })
        $Top=@($Sorted | Where-Object artist | Group-Object artist | Sort-Object @{Expression='Count';Descending=$true},@{Expression='Name';Descending=$false} | Select-Object -First 1 | ForEach-Object Name)[0]
        [void]$SoundtrackRecords.Add([PSCustomObject]@{version=1;driveId=$DriveId;startedAt=$Window.startedAt.ToString('o');endedAt=$Window.endedAt.ToString('o');status='finalized';songCount=$Sorted.Count;topArtist=$Top;songs=$Sorted;sourceLatestPlayedAt=@($ByDrive[$DriveId] | Sort-Object played_at -Descending | Select-Object -First 1 | ForEach-Object played_at)[0];calculatedAt=[DateTimeOffset]::UtcNow.ToString('o')})
    }
    return [PSCustomObject]@{rangeFromUtc=$RangeFromUtc.ToUniversalTime().ToString('o');rangeToUtc=$RangeToUtc.ToUniversalTime().ToString('o');entriesSeen=$Entries.Count;invalidOrNonTrack=$Invalid;outsideRange=$Outside;shortPlays=$Short;exactDuplicates=$Exact;crossProviderMatches=$CrossProvider;noDriveMatch=$NoMatch;ambiguousMatches=$Ambiguous;matchedPlays=@($ByDrive.Values|ForEach-Object{$_}).Count;newHistoryRecords=$HistoryRecords.Count;affectedDrives=$SoundtrackRecords.Count;historyRecords=@($HistoryRecords);soundtrackRecords=@($SoundtrackRecords)}
}

Export-ModuleMember -Function ConvertTo-DriveOSSpotifyExtendedRecord,New-DriveOSSpotifyExtendedImportPlan
