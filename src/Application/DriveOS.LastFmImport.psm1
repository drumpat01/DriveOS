Set-StrictMode -Version 2.0

function Get-DriveOSLastFmValue {
    param([AllowNull()]$Record,[Parameter(Mandatory=$true)][string]$Name)
    if ($null -eq $Record) { return $null }
    $Property = $Record.PSObject.Properties[$Name]
    if (-not $Property) { return $null }
    return $Property.Value
}

function ConvertTo-DriveOSLastFmMatchText {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    return (($Value -replace '[^\p{L}\p{Nd}]','').ToLowerInvariant())
}

function New-DriveOSLastFmStableId {
    param([Parameter(Mandatory=$true)][string]$ProviderKey)
    $Sha = [Security.Cryptography.SHA256]::Create()
    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes("journeydeck`0lastfm_play`0$ProviderKey")
        $Hex = ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()
        return "lastfm|$($Hex.Substring(0,32))"
    }
    finally { $Sha.Dispose() }
}

function ConvertTo-DriveOSLastFmRecord {
    param([Parameter(Mandatory=$true)]$Track,[Parameter(Mandatory=$true)][string]$Username)

    $Date = Get-DriveOSLastFmValue $Track 'date'
    $Uts = if ($Date) { Get-DriveOSLastFmValue $Date 'uts' } else { $null }
    if (-not $Uts) { return $null }

    $ArtistValue = Get-DriveOSLastFmValue $Track 'artist'
    $AlbumValue = Get-DriveOSLastFmValue $Track 'album'
    $Artist = if ($ArtistValue -is [string]) { $ArtistValue } else { Get-DriveOSLastFmValue $ArtistValue '#text' }
    $Album = if ($AlbumValue -is [string]) { $AlbumValue } else { Get-DriveOSLastFmValue $AlbumValue '#text' }
    $TrackName = "$(Get-DriveOSLastFmValue $Track 'name')".Trim()
    $Artist = "$Artist".Trim()
    if (-not $TrackName -or -not $Artist) { return $null }

    $PlayedAt = [DateTimeOffset]::FromUnixTimeSeconds([long]$Uts).ToUniversalTime()
    $ProviderKey = "$Username|$Uts|$Artist|$TrackName|$Album"
    return [PSCustomObject]@{
        id = New-DriveOSLastFmStableId -ProviderKey $ProviderKey
        source = 'lastfm'
        played_at = $PlayedAt.ToString('o')
        duration_ms = 0
        track = $TrackName
        artist = $Artist
        album = "$Album".Trim()
        track_id = $null
        track_uri = $null
        album_image = $null
        spotify_url = $null
        album_spotify_url = $null
        lastfm_url = "$(Get-DriveOSLastFmValue $Track 'url')".Trim()
    }
}

function Test-DriveOSLastFmSameListen {
    param([Parameter(Mandatory=$true)]$Candidate,[Parameter(Mandatory=$true)]$Existing)

    $CandidateTrack = ConvertTo-DriveOSLastFmMatchText "$(Get-DriveOSLastFmValue $Candidate 'track')"
    $ExistingTrack = ConvertTo-DriveOSLastFmMatchText "$(Get-DriveOSLastFmValue $Existing 'track')"
    if (-not $CandidateTrack -or $CandidateTrack -ne $ExistingTrack) { return $false }

    $CandidateArtist = ConvertTo-DriveOSLastFmMatchText "$(Get-DriveOSLastFmValue $Candidate 'artist')"
    $ExistingArtist = ConvertTo-DriveOSLastFmMatchText "$(Get-DriveOSLastFmValue $Existing 'artist')"
    if ($CandidateArtist -and $ExistingArtist -and $CandidateArtist -ne $ExistingArtist) { return $false }

    try {
        $CandidateTime = [DateTimeOffset]::Parse("$(Get-DriveOSLastFmValue $Candidate 'played_at')")
        $ExistingTime = [DateTimeOffset]::Parse("$(Get-DriveOSLastFmValue $Existing 'played_at')")
    }
    catch { return $false }

    $ExistingSource = "$(Get-DriveOSLastFmValue $Existing 'source')".ToLowerInvariant()
    if (-not $ExistingSource -and "$(Get-DriveOSLastFmValue $Existing 'id')" -like 'lastfm|*') { $ExistingSource = 'lastfm' }
    $WindowSeconds = if ($ExistingSource -eq 'spotify') { 720 } else { 5 }
    return [Math]::Abs(($CandidateTime - $ExistingTime).TotalSeconds) -le $WindowSeconds
}

function Get-DriveOSLastFmDriveWindow {
    param([Parameter(Mandatory=$true)]$Drive)
    $StartValue = Get-DriveOSLastFmValue $Drive 'started_at'
    $EndValue = Get-DriveOSLastFmValue $Drive 'ended_at'
    if ($null -eq $StartValue) { $StartValue = Get-DriveOSLastFmValue $Drive 'startedAtEpoch' }
    if ($null -eq $EndValue) { $EndValue = Get-DriveOSLastFmValue $Drive 'endedAtEpoch' }
    if (-not $StartValue -or -not $EndValue) { return $null }
    $StartEpoch = [long]$StartValue
    $EndEpoch = [long]$EndValue
    if ($EndEpoch -le $StartEpoch) { return $null }
    return [PSCustomObject]@{
        driveId = "$StartEpoch-$EndEpoch"
        startedAt = [DateTimeOffset]::FromUnixTimeSeconds($StartEpoch)
        endedAt = [DateTimeOffset]::FromUnixTimeSeconds($EndEpoch)
    }
}

function ConvertTo-DriveOSLastFmSoundtrackSong {
    param([Parameter(Mandatory=$true)]$Record)
    $PlayedAt = [DateTimeOffset]::Parse("$($Record.played_at)").ToLocalTime()
    return [PSCustomObject]@{
        playedAt = $PlayedAt.ToString('o')
        time = $PlayedAt.ToString('h:mm tt')
        track = $Record.track
        artist = $Record.artist
        album = $Record.album
        trackId = $null
        trackUri = $null
        durationMs = 0
        albumImage = $null
        spotifyUrl = $null
        albumSpotifyUrl = $null
        source = 'lastfm'
    }
}

function New-DriveOSLastFmImportPlan {
    param(
        [Parameter(Mandatory=$true)][object[]]$Tracks,
        [Parameter(Mandatory=$true)][object[]]$Drives,
        [object[]]$ExistingHistory=@(),
        [object[]]$ExistingSoundtracks=@(),
        [Parameter(Mandatory=$true)][string]$Username,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeFromUtc,
        [Parameter(Mandatory=$true)][DateTimeOffset]$RangeToUtc,
        [ValidateRange(0,15)][int]$BoundaryToleranceMinutes=5
    )

    $Windows = @($Drives | ForEach-Object { Get-DriveOSLastFmDriveWindow $_ } | Where-Object { $null -ne $_ })
    $SoundtrackMap = @{}
    foreach ($Soundtrack in @($ExistingSoundtracks)) {
        $DriveId = "$(Get-DriveOSLastFmValue $Soundtrack 'driveId')"
        if ($DriveId) { $SoundtrackMap[$DriveId] = $Soundtrack }
    }

    $HistoryRecords = New-Object Collections.ArrayList
    $MatchesByDrive = @{}
    $SeenIds = @{}
    $Seen = 0
    $OutsideRange = 0
    $ExistingDuplicates = 0
    $NoDriveMatch = 0
    $Ambiguous = 0
    $BoundaryMatches = 0
    $DirectMatches = 0
    $Tolerance = [TimeSpan]::FromMinutes($BoundaryToleranceMinutes)

    foreach ($Track in @($Tracks)) {
        $Seen++
        $Record = ConvertTo-DriveOSLastFmRecord -Track $Track -Username $Username
        if (-not $Record) { $OutsideRange++; continue }
        $PlayedAt = [DateTimeOffset]::Parse($Record.played_at).ToUniversalTime()
        if ($PlayedAt -lt $RangeFromUtc.ToUniversalTime() -or $PlayedAt -gt $RangeToUtc.ToUniversalTime()) {
            $OutsideRange++
            continue
        }
        if ($SeenIds.ContainsKey($Record.id)) { $ExistingDuplicates++; continue }
        $SeenIds[$Record.id] = $true

        $IsExisting = $false
        foreach ($Existing in @($ExistingHistory)) {
            if ("$(Get-DriveOSLastFmValue $Existing 'id')" -eq $Record.id -or (Test-DriveOSLastFmSameListen -Candidate $Record -Existing $Existing)) {
                $IsExisting = $true
                break
            }
        }
        if ($IsExisting) { $ExistingDuplicates++; continue }

        $CandidateWindows = @($Windows | Where-Object {
            $PlayedAt -ge $_.startedAt.Subtract($Tolerance) -and
            $PlayedAt -le $_.endedAt.Add($Tolerance)
        })
        if ($CandidateWindows.Count -eq 0) { $NoDriveMatch++; continue }
        if ($CandidateWindows.Count -ne 1) { $Ambiguous++; continue }

        $Window = $CandidateWindows[0]
        if ($PlayedAt -ge $Window.startedAt -and $PlayedAt -le $Window.endedAt) { $DirectMatches++ }
        else { $BoundaryMatches++ }
        [void]$HistoryRecords.Add($Record)
        if (-not $MatchesByDrive.ContainsKey($Window.driveId)) { $MatchesByDrive[$Window.driveId] = New-Object Collections.ArrayList }
        [void]$MatchesByDrive[$Window.driveId].Add($Record)
    }

    $SoundtrackRecords = New-Object Collections.ArrayList
    foreach ($DriveId in @($MatchesByDrive.Keys | Sort-Object)) {
        $Window = @($Windows | Where-Object driveId -eq $DriveId)[0]
        $Existing = if ($SoundtrackMap.ContainsKey($DriveId)) { $SoundtrackMap[$DriveId] } else { $null }
        $Songs = New-Object Collections.ArrayList
        if ($Existing) {
            foreach ($Song in @(Get-DriveOSLastFmValue $Existing 'songs')) { if ($null -ne $Song) { [void]$Songs.Add($Song) } }
        }
        foreach ($Record in @($MatchesByDrive[$DriveId])) {
            $Song = ConvertTo-DriveOSLastFmSoundtrackSong -Record $Record
            $Duplicate = @($Songs | Where-Object {
                try {
                    (ConvertTo-DriveOSLastFmMatchText "$($_.track)") -eq (ConvertTo-DriveOSLastFmMatchText "$($Song.track)") -and
                    (ConvertTo-DriveOSLastFmMatchText "$($_.artist)") -eq (ConvertTo-DriveOSLastFmMatchText "$($Song.artist)") -and
                    [Math]::Abs(([DateTimeOffset]::Parse("$($_.playedAt)") - [DateTimeOffset]::Parse("$($Song.playedAt)")).TotalSeconds) -le 720
                }
                catch { $false }
            }).Count -gt 0
            if (-not $Duplicate) { [void]$Songs.Add($Song) }
        }
        $SortedSongs = @($Songs | Sort-Object { try { [DateTimeOffset]::Parse("$($_.playedAt)") } catch { [DateTimeOffset]::MinValue } })
        $TopArtist = @($SortedSongs | Where-Object artist | Group-Object artist | Sort-Object @{Expression='Count';Descending=$true},@{Expression='Name';Descending=$false} | Select-Object -First 1 | ForEach-Object Name)[0]
        [void]$SoundtrackRecords.Add([PSCustomObject]@{
            version = 1
            driveId = $DriveId
            startedAt = $Window.startedAt.ToString('o')
            endedAt = $Window.endedAt.ToString('o')
            status = 'finalized'
            songCount = $SortedSongs.Count
            topArtist = $TopArtist
            songs = $SortedSongs
            sourceLatestPlayedAt = @($HistoryRecords | Sort-Object played_at -Descending | Select-Object -First 1 | ForEach-Object played_at)[0]
            calculatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        })
    }

    return [PSCustomObject]@{
        rangeFromUtc = $RangeFromUtc.ToUniversalTime().ToString('o')
        rangeToUtc = $RangeToUtc.ToUniversalTime().ToString('o')
        tracksSeen = $Seen
        outsideRangeOrInvalid = $OutsideRange
        existingDuplicates = $ExistingDuplicates
        noDriveMatch = $NoDriveMatch
        ambiguousMatches = $Ambiguous
        directMatches = $DirectMatches
        boundaryMatches = $BoundaryMatches
        matchedPlays = $HistoryRecords.Count
        affectedDrives = $SoundtrackRecords.Count
        historyRecords = @($HistoryRecords)
        soundtrackRecords = @($SoundtrackRecords)
    }
}

Export-ModuleMember -Function ConvertTo-DriveOSLastFmRecord,New-DriveOSLastFmImportPlan
