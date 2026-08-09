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

function ConvertTo-DriveOSSpotifyPlay {
    param([Parameter(Mandatory=$true)]$Item)
    $albumImage = $null
    if ($Item.track.album.images -and $Item.track.album.images.Count -gt 0) { $albumImage = $Item.track.album.images[0].url }
    [PSCustomObject]@{
        id = "$($Item.track.id)|$($Item.played_at)"; played_at = $Item.played_at
        track_id = $Item.track.id; track_uri = $Item.track.uri; track = $Item.track.name
        artist = ($Item.track.artists | ForEach-Object { $_.name }) -join ", "
        album = $Item.track.album.name; duration_ms = $Item.track.duration_ms; album_image = $albumImage
        spotify_url = $Item.track.external_urls.spotify; album_spotify_url = $Item.track.album.external_urls.spotify
    }
}

Export-ModuleMember -Function New-SpotifyClient,Invoke-SpotifyGet,Invoke-SpotifyPost,Get-SpotifyRecentlyPlayed,ConvertTo-DriveOSSpotifyPlay,New-SpotifyPrivatePlaylist,Add-SpotifyPlaylistItems
