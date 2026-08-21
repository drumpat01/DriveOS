function Get-DriveOSTrackId {
    param($Record)
    if ($Record.track_id) { return [string]$Record.track_id }
    if ($Record.id -and [string]$Record.id -match '^([A-Za-z0-9]{10,64})\|') { return $Matches[1] }
    return $null
}

function New-DriveOSMusicStats {
    param([object[]]$History = @(), [datetime]$Today = (Get-Date).Date)
    $topTracks = @($History | Group-Object track,artist | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
        # Prefer an already-enriched Spotify record so a matching Last.fm
        # scrobble cannot accidentally replace usable album artwork.
        $example = $_.Group | Where-Object { $_.album_image -or $_.track_id } | Select-Object -First 1
        if (-not $example) { $example = $_.Group | Select-Object -First 1 }
        [pscustomobject]@{track=$example.track;artist=$example.artist;album=$example.album;plays=$_.Count;trackId=(Get-DriveOSTrackId $example);albumImage=$example.album_image;spotifyUrl=$example.spotify_url}
    })
    $topArtists = @($History | Group-Object artist | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object {
        [pscustomobject]@{artist=$_.Name;plays=$_.Count}
    })
    $daily = @()
    for ($i=13; $i -ge 0; $i--) {
        $day=$Today.Date.AddDays(-$i); $next=$day.AddDays(1); $count=0
        foreach ($record in $History) {
            try { $played=[DateTimeOffset]::Parse($record.played_at).LocalDateTime; if($played -ge $day -and $played -lt $next){$count++} } catch {}
        }
        $daily += [pscustomobject]@{date=$day.ToString('yyyy-MM-dd');label=$day.ToString('ddd');count=$count}
    }
    [pscustomobject]@{totalPlays=$History.Count;topTracks=$topTracks;topArtists=$topArtists;daily=$daily}
}

function New-DriveOSDriveStats {
    param([object[]]$Drives=@(), [int]$PeriodDays=30)
    $miles=0.0; $energy=0.0; $battery=0; $songs=0
    $autopilotMiles=0.0; $autopilotEligibleMiles=0.0; $autopilotKnown=$false
    foreach($drive in $Drives){
        if($null -ne $drive.miles){$miles += [double]$drive.miles}
        if($null -ne $drive.energyKWh){$energy += [double]$drive.energyKWh}
        if($null -ne $drive.batteryUsed){$battery += [int]$drive.batteryUsed}
        $songs += [int]$drive.songCount
        $AutopilotProperty = $drive.PSObject.Properties['autopilotMiles']
        if($AutopilotProperty -and $null -ne $AutopilotProperty.Value){
            $autopilotKnown=$true
            $autopilotMiles += [math]::Max(0,[double]$AutopilotProperty.Value)
            if($null -ne $drive.miles){$autopilotEligibleMiles += [math]::Max(0,[double]$drive.miles)}
        }
    }
    $efficiency=if($miles -gt 0 -and $energy -gt 0){[math]::Round(($energy*1000)/$miles)}else{$null}
    $autopilotPercent=if($autopilotKnown -and $autopilotEligibleMiles -gt 0){[math]::Round(($autopilotMiles/$autopilotEligibleMiles)*100)}else{$null}
    [pscustomobject]@{
        periodDays=$PeriodDays;driveCount=$Drives.Count;totalMiles=[math]::Round($miles,1);totalEnergyKWh=[math]::Round($energy,2)
        totalBatteryUsed=$battery;averageWhMi=$efficiency;soundtrackSongs=$songs
        autopilotMiles=if($autopilotKnown){[math]::Round($autopilotMiles,1)}else{$null}
        autopilotEligibleMiles=if($autopilotKnown){[math]::Round($autopilotEligibleMiles,1)}else{$null}
        autopilotPercent=$autopilotPercent
    }
}

Export-ModuleMember -Function New-DriveOSMusicStats,New-DriveOSDriveStats
