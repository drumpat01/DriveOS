Set-StrictMode -Version 2.0

function New-SpotifyClient {
    param([Parameter(Mandatory=$true)][string]$AccessToken, [string]$ApiBaseUri = "https://api.spotify.com/v1")
    [PSCustomObject]@{ ApiBaseUri = $ApiBaseUri.TrimEnd('/'); Headers = @{ Authorization = "Bearer $AccessToken" } }
}

function Invoke-SpotifyGet {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$PathAndQuery)
    Invoke-RestMethod -Uri ($Client.ApiBaseUri + "/" + $PathAndQuery.TrimStart('/')) -Headers $Client.Headers -Method Get
}

function Invoke-SpotifyPost {
    param([Parameter(Mandatory=$true)]$Client,[Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)]$Body)
    Invoke-RestMethod -Uri ($Client.ApiBaseUri + "/" + $Path.TrimStart('/')) -Headers $Client.Headers -ContentType 'application/json' -Method Post -Body ($Body|ConvertTo-Json -Depth 10 -Compress)
}

function New-SpotifyPrivatePlaylist {
    param($Client,[string]$Name,[string]$Description)
    Invoke-SpotifyPost -Client $Client -Path 'me/playlists' -Body @{name=$Name;public=$false;description=$Description}
}

function Add-SpotifyPlaylistItems {
    param($Client,[string]$PlaylistId,[string[]]$Uris)
    for($i=0;$i -lt $Uris.Count;$i+=100){
        $last=[math]::Min($i+99,$Uris.Count-1)
        $null=Invoke-SpotifyPost -Client $Client -Path "playlists/$PlaylistId/items" -Body @{uris=@($Uris[$i..$last])}
    }
}

function Get-SpotifyRecentlyPlayed {
    param([Parameter(Mandatory=$true)]$Client, [ValidateRange(1,50)][int]$Limit = 50)
    $response = Invoke-SpotifyGet -Client $Client -PathAndQuery "me/player/recently-played?limit=$Limit"
    return @($response.items)
}

function Find-SpotifyTrack {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Track,
        [Parameter(Mandatory=$true)][string]$Artist
    )

    $Query = [Uri]::EscapeDataString("track:$Track artist:$Artist")
    $Response = Invoke-SpotifyGet -Client $Client -PathAndQuery "search?q=$Query&type=track&limit=5"
    $Candidates = @($Response.tracks.items)
    $Normalize = {
        param([string]$Value)
        return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
    }
    $WantedTrack = & $Normalize $Track
    $WantedArtist = & $Normalize $Artist

    foreach ($Candidate in $Candidates) {
        $CandidateTrack = & $Normalize ([string]$Candidate.name)
        $CandidateArtists = @($Candidate.artists | ForEach-Object { & $Normalize ([string]$_.name) })

        if ($CandidateTrack -eq $WantedTrack -and $CandidateArtists -contains $WantedArtist) {
            return $Candidate
        }
    }

    # Last.fm artist credits occasionally differ slightly from Spotify's
    # catalog spelling. The constrained query plus an exact title match is a
    # safe fallback for recovering that track's album artwork.
    foreach ($Candidate in $Candidates) {
        if ((& $Normalize ([string]$Candidate.name)) -eq $WantedTrack) {
            return $Candidate
        }
    }

    return $null
}

function Find-SpotifyArtist {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Artist
    )

    $Query = [Uri]::EscapeDataString("artist:$Artist")
    $Response = Invoke-SpotifyGet -Client $Client -PathAndQuery "search?q=$Query&type=artist&limit=5"
    $Candidates = @($Response.artists.items)
    $Normalize = {
        param([string]$Value)
        return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
    }
    $WantedArtist = & $Normalize $Artist

    foreach ($Candidate in $Candidates) {
        if ((& $Normalize ([string]$Candidate.name)) -eq $WantedArtist) {
            return $Candidate
        }
    }

    return $null
}

function Find-SpotifyLatestArtistAlbum {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Artist
    )

    $Query = [Uri]::EscapeDataString("artist:$Artist")
    $Response = Invoke-SpotifyGet -Client $Client -PathAndQuery "search?q=$Query&type=album&limit=10"
    $Normalize = {
        param([string]$Value)
        return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
    }
    $WantedArtist = & $Normalize $Artist
    $Albums = @($Response.albums.items | Where-Object {
        @($_.artists | ForEach-Object { & $Normalize ([string]$_.name) }) -contains $WantedArtist
    } | Sort-Object { "$($_.release_date)" } -Descending)

    return $Albums | Select-Object -First 1
}

function Find-SpotifyAlbum {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Album,
        [Parameter(Mandatory=$true)][string]$Artist
    )

    $Query = [Uri]::EscapeDataString("album:$Album artist:$Artist")
    $Response = Invoke-SpotifyGet -Client $Client -PathAndQuery "search?q=$Query&type=album&limit=10"
    $Normalize = {
        param([string]$Value)
        return (($Value -replace '[^\p{L}\p{Nd}]', '').ToLowerInvariant())
    }
    $WantedAlbum = & $Normalize $Album
    $WantedArtist = & $Normalize $Artist

    return @($Response.albums.items | Where-Object {
        (& $Normalize ([string]$_.name)) -eq $WantedAlbum -and
        (@($_.artists | ForEach-Object { & $Normalize ([string]$_.name) }) -contains $WantedArtist)
    }) | Select-Object -First 1
}

function ConvertTo-DriveOSSpotifyPlay {
    param([Parameter(Mandatory=$true)]$Item)
    $albumImage = $null
    if ($Item.track.album.images -and $Item.track.album.images.Count -gt 0) { $albumImage = $Item.track.album.images[0].url }
    [PSCustomObject]@{
        id = "$($Item.track.id)|$($Item.played_at)"; source = "spotify"; played_at = $Item.played_at
        track_id = $Item.track.id; track_uri = $Item.track.uri; track = $Item.track.name
        artist = ($Item.track.artists | ForEach-Object { $_.name }) -join ", "
        album = $Item.track.album.name; duration_ms = $Item.track.duration_ms; album_image = $albumImage
        spotify_url = $Item.track.external_urls.spotify; album_spotify_url = $Item.track.album.external_urls.spotify
    }
}

Export-ModuleMember -Function New-SpotifyClient,Invoke-SpotifyGet,Invoke-SpotifyPost,Get-SpotifyRecentlyPlayed,Find-SpotifyTrack,Find-SpotifyArtist,Find-SpotifyLatestArtistAlbum,Find-SpotifyAlbum,ConvertTo-DriveOSSpotifyPlay,New-SpotifyPrivatePlaylist,Add-SpotifyPlaylistItems
