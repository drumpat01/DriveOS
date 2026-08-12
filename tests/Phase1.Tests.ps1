$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\LastFm\DriveOS.LastFm.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Foursquare\DriveOS.Foursquare.psm1") -Force
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

    $LastFmItem = [pscustomobject]@{
        name = "Song"
        artist = [pscustomobject]@{ '#text' = "Artist" }
        album = [pscustomobject]@{ '#text' = "Album" }
        date = [pscustomobject]@{ uts = "1767225600" }
        url = "https://www.last.fm/music/Artist/_/Song"
        mbid = ""
    }
    $LastFmPlay = ConvertTo-DriveOSLastFmPlay -Item $LastFmItem -SpotifyTrack $Item.track
    if ($LastFmPlay.source -ne "lastfm" -or $LastFmPlay.track_id -ne "track1" -or $LastFmPlay.artist -ne "Artist") {
        throw "Last.fm model mapping or Spotify enrichment failed"
    }
    if ($LastFmPlay.id -notmatch '^lastfm\|1767225600\|[0-9a-f]{16}$') { throw "Last.fm stable record ID failed" }

    $FoursquareClient = New-FoursquareClient -ApiKey "test-service-key"
    if ($FoursquareClient.Headers.Authorization -ne "Bearer test-service-key") { throw "Foursquare bearer authentication failed" }
    if ($FoursquareClient.Headers.'X-Places-Api-Version' -ne "2025-06-17") { throw "Foursquare API version header failed" }
    $FoursquarePlace = ConvertTo-DriveOSFoursquarePlace -Place ([pscustomobject]@{
        fsq_place_id='place1';name='Coffee Shop';distance=24;latitude=32.75;longitude=-97.33
        location=[pscustomobject]@{formatted_address='123 Main St'}
        categories=@([pscustomobject]@{name='Coffee Shop'})
    })
    if ($FoursquarePlace.id -ne 'place1' -or $FoursquarePlace.name -ne 'Coffee Shop' -or $FoursquarePlace.category -ne 'Coffee Shop') {
        throw "Foursquare provider mapping failed"
    }
    $Match = Select-DriveOSFoursquareMatch -Places @(
        [pscustomobject]@{name='Too Far';distanceMeters=70},
        [pscustomobject]@{name='Nearby';distanceMeters=22}
    ) -MaximumDistanceMeters 60
    if ($Match.name -ne 'Nearby') { throw "Foursquare distance matching failed" }
    $LookupCandidates = @(Select-DriveOSPlaceLookupCandidates -Candidates @(
        [pscustomobject]@{location='Home address';manualLabel='Home';uses=20;latitude=32;longitude=-97},
        [pscustomobject]@{location='Business';manualLabel='';uses=5;latitude=32;longitude=-97},
        [pscustomobject]@{location='One off';manualLabel='';uses=1;latitude=32;longitude=-97}
    ))
    if ($LookupCandidates.Count -ne 1 -or $LookupCandidates[0].location -ne 'Business') { throw "Foursquare privacy candidate filtering failed" }
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage ([pscustomobject]@{
        day=(Get-Date).ToString('yyyy-MM-dd');dayCount=10;month=(Get-Date).ToString('yyyy-MM');monthCount=20
    }) -DailyLimit 10 -MonthlyLimit 250
    if ($Usage.canCall -or $Usage.dayRemaining -ne 0) { throw "Foursquare daily budget stop failed" }
    if ((Get-DriveOSPlaceCacheKey -Location ' 123 MAIN St ') -ne (Get-DriveOSPlaceCacheKey -Location '123 main st')) {
        throw "Foursquare stable address cache key failed"
    }

    $ServerSource = Get-Content (Join-Path $Root "DriveOS-Server.ps1") -Raw
    if ($ServerSource -match '(?m)^\s*\$Response\.EnsureSuccessStatusCode\(\)\s*$') {
        throw "Spotify artwork download leaks HttpResponseMessage into the binary response."
    }
    if ($ServerSource -notmatch '\$null\s*=\s*\$Response\.EnsureSuccessStatusCode\(\)') {
        throw "Spotify artwork status validation must suppress its response object."
    }
    if ($ServerSource -notmatch "api_key=.*REDACTED") { throw "Last.fm log redaction is missing" }
    if ($ServerSource -notmatch 'FoursquareDailyLimit\s*=\s*10' -or $ServerSource -notmatch 'FoursquareMonthlyLimit\s*=\s*250') {
        throw "Foursquare free-tier guardrails are missing"
    }

    & (Join-Path $Root "tools\Sync-Version.ps1") -Check
    Write-Host "Phase 1 offline tests passed."
}
finally {
    if (Test-Path $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
}
