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

Export-ModuleMember -Function New-DriveOSPlaylistPlan,New-DriveOSPlaylistFromDrive
