$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root "src\Storage\DriveOS.Storage.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Spotify\DriveOS.Spotify.psm1") -Force
Import-Module (Join-Path $Root "src\Integrations\Tessie\DriveOS.Tessie.psm1") -Force

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
    if ($Play.id -ne "track1|2026-01-01T00:00:00Z" -or $Play.artist -ne "Artist") { throw "Spotify model mapping failed" }

    $ServerSource = Get-Content (Join-Path $Root "DriveOS-Server.ps1") -Raw
    if ($ServerSource -match '(?m)^\s*\$Response\.EnsureSuccessStatusCode\(\)\s*$') {
        throw "Spotify artwork download leaks HttpResponseMessage into the binary response."
    }
    if ($ServerSource -notmatch '\$null\s*=\s*\$Response\.EnsureSuccessStatusCode\(\)') {
        throw "Spotify artwork status validation must suppress its response object."
    }

    & (Join-Path $Root "tools\Sync-Version.ps1") -Check
    Write-Host "Phase 1 offline tests passed."
}
finally {
    if (Test-Path $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
}
