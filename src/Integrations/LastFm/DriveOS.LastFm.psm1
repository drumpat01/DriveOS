Set-StrictMode -Version 2.0

function New-LastFmClient {
    param(
        [Parameter(Mandatory=$true)][string]$Username,
        [Parameter(Mandatory=$true)][string]$ApiKey,
        [string]$ApiBaseUri = "https://ws.audioscrobbler.com/2.0/"
    )

    [PSCustomObject]@{
        Username   = $Username.Trim()
        ApiKey     = $ApiKey.Trim()
        ApiBaseUri = $ApiBaseUri.TrimEnd('/')
    }
}

function Invoke-LastFmGet {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][hashtable]$Parameters
    )

    $Query = @{
        api_key = $Client.ApiKey
        format  = "json"
    }

    foreach ($Entry in $Parameters.GetEnumerator()) {
        $Query[$Entry.Key] = $Entry.Value
    }

    $Pairs = @($Query.GetEnumerator() | Sort-Object Key | ForEach-Object {
        "{0}={1}" -f [Uri]::EscapeDataString([string]$_.Key), [Uri]::EscapeDataString([string]$_.Value)
    })

    Invoke-RestMethod -Uri ($Client.ApiBaseUri + "/?" + ($Pairs -join "&")) -Method Get
}

function Get-LastFmRecentTracks {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [long]$FromUnix = 0,
        [long]$ToUnix = 0,
        [ValidateRange(1,200)][int]$Limit = 200,
        # Use 0 to follow Last.fm's full reported page count. Routine syncs
        # retain a finite limit, while a user-requested history import can
        # deliberately retrieve the entire archive.
        [ValidateRange(0,100000)][int]$MaxPages = 25
    )

    $Items = @()
    $Page = 1
    $TotalPages = 1

    do {
        $Parameters = @{
            method = "user.getRecentTracks"
            user   = $Client.Username
            limit  = $Limit
            page   = $Page
        }

        if ($FromUnix -gt 0) { $Parameters.from = $FromUnix }
        if ($ToUnix -gt 0) { $Parameters.to = $ToUnix }

        $Response = Invoke-LastFmGet -Client $Client -Parameters $Parameters

        if ($Response.PSObject.Properties['error'] -and $Response.error) {
            throw "Last.fm error $($Response.error): $($Response.message)"
        }

        $Tracks = @()
        if ($Response.recenttracks.PSObject.Properties['track']) {
            $Tracks = @($Response.recenttracks.track)
        }

        foreach ($Track in $Tracks) {
            # Last.fm includes the currently-playing item without a final timestamp.
            # It will be imported on the next sync after Last.fm has scrobbled it.
            if (
                $Track.PSObject.Properties['date'] -and
                $Track.date -and
                $Track.date.PSObject.Properties['uts'] -and
                $Track.date.uts
            ) {
                $Items += $Track
            }
        }

        if (
            $Response.recenttracks.PSObject.Properties['@attr'] -and
            $Response.recenttracks.'@attr'.PSObject.Properties['totalPages'] -and
            $Response.recenttracks.'@attr'.totalPages
        ) {
            $TotalPages = [Math]::Max(1, [int]$Response.recenttracks.'@attr'.totalPages)
        }

        $Page++
    } while ($Page -le $TotalPages -and ($MaxPages -eq 0 -or $Page -le $MaxPages))

    return $Items
}

function Get-LastFmTextValue {
    param($Value)

    if ($null -eq $Value) { return $null }
    if ($Value.PSObject.Properties['#text']) { return [string]$Value.'#text' }
    return [string]$Value
}

function Get-LastFmRecordId {
    param([Parameter(Mandatory=$true)]$Item)

    $Seed = "{0}|{1}|{2}" -f $Item.date.uts, (Get-LastFmTextValue $Item.artist), $Item.name
    $Hasher = [Security.Cryptography.SHA256]::Create()

    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes($Seed.ToLowerInvariant())
        $Hash = ([BitConverter]::ToString($Hasher.ComputeHash($Bytes))).Replace("-", "").Substring(0, 16).ToLowerInvariant()
    }
    finally {
        $Hasher.Dispose()
    }

    return "lastfm|$($Item.date.uts)|$Hash"
}

function ConvertTo-DriveOSLastFmPlay {
    param(
        [Parameter(Mandatory=$true)]$Item,
        $SpotifyTrack = $null
    )

    $PlayedAt = [DateTimeOffset]::FromUnixTimeSeconds([long]$Item.date.uts).ToUniversalTime().ToString("o")
    $Artist = Get-LastFmTextValue $Item.artist
    $Album = Get-LastFmTextValue $Item.album
    $LastFmUrl = if ($Item.PSObject.Properties['url'] -and $Item.url) { [string]$Item.url } else { $null }
    $LastFmMbid = if ($Item.PSObject.Properties['mbid'] -and $Item.mbid) { [string]$Item.mbid } else { $null }
    $TrackId = $null
    $TrackUri = $null
    $DurationMs = $null
    $AlbumImage = $null
    $SpotifyUrl = $null
    $AlbumSpotifyUrl = $null

    if ($SpotifyTrack) {
        $TrackId = $SpotifyTrack.id
        $TrackUri = $SpotifyTrack.uri
        $DurationMs = $SpotifyTrack.duration_ms
        $SpotifyUrl = $SpotifyTrack.external_urls.spotify
        $AlbumSpotifyUrl = $SpotifyTrack.album.external_urls.spotify

        if ($SpotifyTrack.album.images -and $SpotifyTrack.album.images.Count -gt 0) {
            $AlbumImage = $SpotifyTrack.album.images[0].url
        }

        if (-not $Album) { $Album = $SpotifyTrack.album.name }
    }

    [PSCustomObject]@{
        id                = Get-LastFmRecordId -Item $Item
        source            = "lastfm"
        played_at         = $PlayedAt
        track_id          = $TrackId
        track_uri         = $TrackUri
        track             = [string]$Item.name
        artist            = $Artist
        album             = $Album
        duration_ms       = $DurationMs
        album_image       = $AlbumImage
        spotify_url       = $SpotifyUrl
        album_spotify_url = $AlbumSpotifyUrl
        lastfm_url        = $LastFmUrl
        lastfm_mbid       = $LastFmMbid
    }
}

Export-ModuleMember -Function New-LastFmClient,Invoke-LastFmGet,Get-LastFmRecentTracks,ConvertTo-DriveOSLastFmPlay
