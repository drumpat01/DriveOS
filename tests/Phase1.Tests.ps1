$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\LastFm\DriveOS.LastFm.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Tessie\DriveOS.Tessie.psm1") -Force
Import-Module (Join-Path $Root "src\Application\DriveOS.PlaceEnrichment.psm1") -Force

$Scratch = Join-Path ([IO.Path]::GetTempPath()) ("driveos-phase1-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Scratch | Out-Null
try {
    $Json = Join-Path $Scratch "settings.json"
    Write-DriveOSJson -Path $Json -Value ([pscustomobject]@{ electricityRateCents = 12.5 })
    if ((Read-DriveOSJson -Path $Json).electricityRateCents -ne 12.5) { throw "JSON round trip failed" }

    $Jsonl = Join-Path $Scratch "history.jsonl"
    Add-DriveOSJsonLine -Path $Jsonl -Value ([pscustomobject]@{ id = "one" })
    Add-DriveOSJsonLine -Path $Jsonl -Value ([pscustomobject]@{ id = "two" })
    if (@(Read-DriveOSJsonLines -Path $Jsonl).Count -ne 2) { throw "JSONL round trip failed" }

    $Tessie = New-TessieClient -Token "test-token"
    if ($Tessie.Headers.Authorization -ne "Bearer test-token") { throw "Tessie client contract failed" }

    $Item = [pscustomobject]@{ played_at="2026-01-01T00:00:00Z"; track=[pscustomobject]@{
        id="track1"; uri="spotify:track:track1"; name="Song"; duration_ms=1000
        artists=@([pscustomobject]@{name="Artist"}); external_urls=[pscustomobject]@{spotify="https://open.spotify.com/track/track1"}
        album=[pscustomobject]@{name="Album"; images=@(); external_urls=[pscustomobject]@{spotify=$null}}
    }}
    $Play = ConvertTo-DriveOSSpotifyPlay -Item $Item
    if ($Play.id -ne 'track1|2026-01-01T00:00:00.000Z' -or $Play.played_at -ne '2026-01-01T00:00:00.000Z') {
        throw "Spotify play timestamp normalization failed"
    }

    $DateItem = [pscustomobject]@{
        played_at = [datetime]::SpecifyKind([datetime]'2026-01-01T00:00:00', [DateTimeKind]::Utc)
        track = $Item.track
    }
    $DatePlay = ConvertTo-DriveOSSpotifyPlay -Item $DateItem
    if ($DatePlay.id -ne $Play.id -or $DatePlay.played_at -ne $Play.played_at) {
        throw "Spotify play ID must be invariant across timestamp representations"
    }
    if ($Play.artist -ne "Artist" -or $Play.source -ne "spotify") { throw "Spotify model mapping failed" }

    $LastFmHistoryPath = Join-Path $Scratch 'lastfm-history.jsonl'
    $LastFmPlay = [pscustomobject]@{
        id = 'lastfm|1767225600|0123456789abcdef'
        played_at = '2026-01-01T00:00:00Z'
        source = 'lastfm'
        track_id = 'track1'
        track_name = 'Song'
        artist = 'Artist'
        album = 'Album'
        external_url = 'https://www.last.fm/music/Artist/_/Song'
    }
    Add-DriveOSJsonLine -Path $LastFmHistoryPath -Value $LastFmPlay
    $LastFmArchive = @(Read-DriveOSJsonLines -Path $LastFmHistoryPath)
    if ($LastFmArchive.Count -ne 1 -or $LastFmArchive[0].source -ne 'lastfm' -or $LastFmArchive[0].track_id -ne 'track1') {
        throw 'Historical Last.fm listening records no longer round-trip through the shared archive.'
    }

    $ServerSource = Get-Content (Join-Path $Root "DriveOS-Server.ps1") -Raw
    if ($ServerSource -match '(?m)^\s*\$Response\.EnsureSuccessStatusCode\(\)\s*$') {
        throw "Spotify artwork download leaks HttpResponseMessage into the binary response."
    }
    if ($ServerSource -notmatch '\$null\s*=\s*\$Response\.EnsureSuccessStatusCode\(\)') {
        throw "Spotify artwork status validation must suppress its response object."
    }
    if ($ServerSource -notmatch 'Last.fm active integration was retired') { throw "Last.fm retirement compatibility marker is missing" }
    if ($ServerSource -notmatch '"/api/atlas/places"' -or $ServerSource -notmatch '"/api/atlas/places/scan"') {
        throw "Atlas place enrichment endpoints are missing"
    }

    & (Join-Path $Root "tools\Sync-Version.ps1") -Check
    Write-Host "Phase 1 offline tests passed."
}
finally {
    if (Test-Path $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
}
