function New-DriveOSPlaylistPlan {
    param([Parameter(Mandatory=$true)]$Drive)
    if(-not $Drive.soundtrack -or $Drive.soundtrack.Count -eq 0){throw 'No archived Spotify tracks overlap this drive.'}
    $uris=@()
    foreach($track in $Drive.soundtrack){if($track.trackUri -and $uris -notcontains $track.trackUri){$uris += [string]$track.trackUri}}
    if(-not $uris.Count){throw 'No Spotify track IDs were available for this drive.'}
    [pscustomobject]@{name="DriveOS - $($Drive.shortDateLabel) $($Drive.startTime)";description='Drive soundtrack captured by DriveOS.';uris=$uris}
}

function New-DriveOSPlaylistFromDrive {
    param([Parameter(Mandatory=$true)]$Drive,[Parameter(Mandatory=$true)]$SpotifyClient)
    $plan=New-DriveOSPlaylistPlan -Drive $Drive
    $name=$plan.name
    $playlist=New-SpotifyPrivatePlaylist -Client $SpotifyClient -Name $name -Description $plan.description
    Add-SpotifyPlaylistItems -Client $SpotifyClient -PlaylistId $playlist.id -Uris $plan.uris
    [pscustomobject]@{success=$true;playlistId=$playlist.id;playlistName=$name;trackCount=$plan.uris.Count;url=if($playlist.external_urls.spotify){$playlist.external_urls.spotify}else{$null}}
}

function Get-DriveOSCommuteTrackPool {
    param([Parameter(Mandatory=$true)][object[]]$History)

    $tracks = @{}
    foreach ($record in @($History)) {
        $uri = [string]$record.track_uri
        if (-not $uri -and $record.track_id) { $uri = "spotify:track:$($record.track_id)" }
        if ($uri -notmatch '^spotify:track:[A-Za-z0-9]+$') { continue }

        $playedAt = $null
        try { $playedAt = [DateTimeOffset]::Parse([string]$record.played_at) } catch { continue }

        $durationMs = 0
        try { $durationMs = [int64]$record.duration_ms } catch {}
        if ($durationMs -lt 45000 -or $durationMs -gt 1200000) { continue }

        if (-not $tracks.ContainsKey($uri)) {
            $tracks[$uri] = [pscustomobject]@{
                uri        = $uri
                track      = [string]$record.track
                artist     = [string]$record.artist
                durationMs = $durationMs
                playCount  = 0
                latestPlay = $playedAt
            }
        }

        $item = $tracks[$uri]
        $item.playCount++
        if ($playedAt -gt $item.latestPlay) { $item.latestPlay = $playedAt }
        if (-not $item.durationMs -and $durationMs) { $item.durationMs = $durationMs }
    }

    return @($tracks.Values)
}

function Add-DriveOSCommuteBucket {
    param(
        [Parameter(Mandatory=$true)][AllowEmptyCollection()][System.Collections.ArrayList]$Selected,
        [Parameter(Mandatory=$true)][object[]]$Candidates,
        [Parameter(Mandatory=$true)][int]$Count,
        [Parameter(Mandatory=$true)][string]$Kind
    )

    for ($index = 0; $index -lt $Count; $index++) {
        $available = @($Candidates | Where-Object {
            $candidate = $_
            -not @($Selected | Where-Object { $_.uri -eq $candidate.uri }).Count
        })
        if (-not $available.Count) { break }
        $choice = @($available | Get-Random -Count 1)[0]
        [void]$Selected.Add([pscustomobject]@{ uri=$choice.uri; track=$choice.track; artist=$choice.artist; durationMs=$choice.durationMs; kind=$Kind })
    }
}

function New-DriveOSCommutePlaylistPlan {
    param(
        [Parameter(Mandatory=$true)][object[]]$History,
        [Parameter(Mandatory=$true)][string]$DestinationName,
        [ValidateSet('focused','upbeat','comfort','surprise')][string]$Mood = 'focused',
        [ValidateRange(5,180)][int]$ExpectedMinutes = 25
    )

    $pool = @(Get-DriveOSCommuteTrackPool -History $History)
    if ($pool.Count -lt 4) { throw 'DriveOS needs at least four archived Spotify tracks to build a commute mix.' }

    $now = [DateTimeOffset]::Now
    $recentCutoff = $now.AddDays(-7)
    $eligible = @($pool | Where-Object { $_.latestPlay -lt $recentCutoff })
    if ($eligible.Count -lt 4) { $eligible = $pool }

    $favorites = @($eligible | Where-Object { $_.playCount -ge 3 } | Sort-Object @{Expression='playCount';Descending=$true}, @{Expression='latestPlay';Descending=$false})
    $rediscoveries = @($eligible | Where-Object { $_.playCount -ge 2 -and $_.latestPlay -lt $now.AddDays(-21) } | Sort-Object latestPlay)
    $fresh = @($eligible | Where-Object { $_.playCount -le 2 -and $_.latestPlay -lt $now.AddDays(-30) } | Sort-Object latestPlay)

    $mix = switch ($Mood) {
        'upbeat'   { @(0.35, 0.30, 0.35) }
        'comfort'  { @(0.60, 0.32, 0.08) }
        'surprise' { @(0.25, 0.35, 0.40) }
        default    { @(0.45, 0.35, 0.20) }
    }

    $targetTracks = [Math]::Max(5, [Math]::Min(15, [int][Math]::Ceiling($ExpectedMinutes / 3.5) + 1))
    $favoriteCount = [int][Math]::Round($targetTracks * $mix[0])
    $rediscoveryCount = [int][Math]::Round($targetTracks * $mix[1])
    $freshCount = [Math]::Max(1, $targetTracks - $favoriteCount - $rediscoveryCount)
    $selected = New-Object System.Collections.ArrayList

    Add-DriveOSCommuteBucket -Selected $selected -Candidates $favorites -Count $favoriteCount -Kind 'favorite'
    Add-DriveOSCommuteBucket -Selected $selected -Candidates $rediscoveries -Count $rediscoveryCount -Kind 'rediscovery'
    Add-DriveOSCommuteBucket -Selected $selected -Candidates $fresh -Count $freshCount -Kind 'fresh'
    Add-DriveOSCommuteBucket -Selected $selected -Candidates $eligible -Count ($targetTracks - $selected.Count) -Kind 'mix'
    Add-DriveOSCommuteBucket -Selected $selected -Candidates $pool -Count ($targetTracks - $selected.Count) -Kind 'mix'

    if ($selected.Count -lt 4) { throw 'DriveOS could not find enough distinct Spotify tracks for this commute.' }

    $playlistMinutes = [Math]::Round((($selected | Measure-Object durationMs -Sum).Sum / 60000), 0)
    $moodName = switch ($Mood) { 'upbeat' {'Upbeat'} 'comfort' {'Comfort'} 'surprise' {'Surprise'} default {'Focus'} }
    $stamp = (Get-Date).ToString('ddd h:mm tt')
    $breakdown = [ordered]@{
        favorites = @($selected | Where-Object kind -eq 'favorite').Count
        rediscoveries = @($selected | Where-Object kind -eq 'rediscovery').Count
        fresh = @($selected | Where-Object kind -eq 'fresh').Count
    }

    return [pscustomobject]@{
        name = "DriveOS - $DestinationName $moodName - $stamp"
        description = "DriveOS commute mix: $($breakdown.favorites) favorites, $($breakdown.rediscoveries) rediscoveries, and $($breakdown.fresh) fresh picks."
        uris = @($selected | ForEach-Object uri)
        trackCount = $selected.Count
        playlistMinutes = [int]$playlistMinutes
        breakdown = [pscustomobject]$breakdown
        tracks = @($selected)
    }
}

function New-DriveOSCommutePlaylist {
    param(
        [Parameter(Mandatory=$true)][object[]]$History,
        [Parameter(Mandatory=$true)][string]$DestinationName,
        [Parameter(Mandatory=$true)]$SpotifyClient,
        [ValidateSet('focused','upbeat','comfort','surprise')][string]$Mood = 'focused',
        [ValidateRange(5,180)][int]$ExpectedMinutes = 25
    )

    $plan = New-DriveOSCommutePlaylistPlan -History $History -DestinationName $DestinationName -Mood $Mood -ExpectedMinutes $ExpectedMinutes
    $playlist = New-SpotifyPrivatePlaylist -Client $SpotifyClient -Name $plan.name -Description $plan.description
    Add-SpotifyPlaylistItems -Client $SpotifyClient -PlaylistId $playlist.id -Uris $plan.uris
    [pscustomobject]@{
        success = $true; playlistId = $playlist.id; playlistName = $plan.name; url = if($playlist.external_urls.spotify){$playlist.external_urls.spotify}else{$null}
        trackCount = $plan.trackCount; playlistMinutes = $plan.playlistMinutes; breakdown = $plan.breakdown
    }
}

Export-ModuleMember -Function New-DriveOSPlaylistPlan,New-DriveOSPlaylistFromDrive,New-DriveOSCommutePlaylistPlan,New-DriveOSCommutePlaylist
