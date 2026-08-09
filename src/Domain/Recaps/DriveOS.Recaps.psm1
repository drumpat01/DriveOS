function New-DriveOSMonthlyRecaps {
    param([object[]]$Drives=@(),[object[]]$Charges=@(),$Settings,[datetime]$Now=(Get-Date))
    $recaps=@()
    for($offset=0;$offset -lt 12;$offset++){
        $point=$Now.AddMonths(-$offset);$monthStart=Get-Date -Year $point.Year -Month $point.Month -Day 1;$monthEnd=$monthStart.AddMonths(1)
        $monthDrives=@($Drives|Where-Object{$d=[DateTimeOffset]::Parse($_.startedAt).LocalDateTime;$d -ge $monthStart -and $d -lt $monthEnd})
        $monthCharges=@($Charges|Where-Object{$d=[DateTimeOffset]::Parse($_.startedAt).LocalDateTime;$d -ge $monthStart -and $d -lt $monthEnd})
        $miles=[math]::Round((($monthDrives|Measure-Object miles -Sum).Sum),1);$energy=[math]::Round((($monthDrives|Measure-Object energyKWh -Sum).Sum),2)
        $battery=[math]::Round((($monthDrives|Measure-Object batteryUsed -Sum).Sum));$songs=[int](($monthDrives|Measure-Object songCount -Sum).Sum)
        $average=if($miles -gt 0 -and $energy -gt 0){[math]::Round(($energy*1000)/$miles)}else{$null}
        $routes=@{};$tracks=@{};$artists=@{}
        foreach($drive in $monthDrives){
            $route="$($drive.startingLocation) -> $($drive.endingLocation)";if(-not $routes.ContainsKey($route)){$routes[$route]=0};$routes[$route]++
            foreach($song in @($drive.soundtrack)){$key="$($song.track)`0$($song.artist)";if(-not $tracks.ContainsKey($key)){$tracks[$key]=0};$tracks[$key]++;if($song.artist){if(-not $artists.ContainsKey([string]$song.artist)){$artists[[string]$song.artist]=0};$artists[[string]$song.artist]++}}
        }
        $favorite=$routes.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 1;$topTrack=$tracks.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 1
        $topArtist=$artists.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 1;$longest=$monthDrives|Sort-Object miles -Descending|Select-Object -First 1
        $chargeEnergy=[math]::Round((($monthCharges|Measure-Object energyAddedKWh -Sum).Sum),2);$known=@($monthCharges|Where-Object{$null -ne $_.displayCost})
        $chargeCost=if($known.Count){[math]::Round((($known|Measure-Object displayCost -Sum).Sum),2)}else{$null};$trackName=$null;$trackArtist=$null
        if($topTrack){$parts=[string]$topTrack.Name -split "`0",2;$trackName=$parts[0];if($parts.Count -gt 1){$trackArtist=$parts[1]}}
        $recaps += [pscustomobject]@{monthKey=$monthStart.ToString('yyyy-MM');monthLabel=$monthStart.ToString('MMMM yyyy');driveCount=$monthDrives.Count;miles=$miles;driveEnergyKWh=$energy;averageWhMi=$average;batteryUsed=$battery;soundtrackPlays=$songs;uniqueSongs=@($tracks.Keys).Count;favoriteRoute=if($favorite){$favorite.Name}else{$null};favoriteRouteCount=if($favorite){[int]$favorite.Value}else{0};longestDriveMiles=if($longest){$longest.miles}else{$null};longestDriveDate=if($longest){$longest.shortDateLabel}else{$null};topTrack=$trackName;topTrackArtist=$trackArtist;topTrackPlays=if($topTrack){[int]$topTrack.Value}else{0};topArtist=if($topArtist){$topArtist.Name}else{$null};topArtistPlays=if($topArtist){[int]$topArtist.Value}else{0};chargingSessions=$monthCharges.Count;chargingEnergyKWh=$chargeEnergy;chargingCost=$chargeCost;chargingKnownCostSessions=$known.Count}
    }
    [pscustomobject]@{recaps=$recaps;settings=$Settings}
}
Export-ModuleMember -Function New-DriveOSMonthlyRecaps
