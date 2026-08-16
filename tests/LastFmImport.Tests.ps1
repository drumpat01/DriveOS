$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Application\DriveOS.LastFmImport.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}

function New-Track([long]$Uts,[string]$Name='Song',[string]$Artist='Artist'){
    [PSCustomObject]@{name=$Name;artist=[PSCustomObject]@{'#text'=$Artist};album=[PSCustomObject]@{'#text'='Album'};date=[PSCustomObject]@{uts="$Uts"};url='https://last.fm/track'}
}
$Start=[DateTimeOffset]::Parse('2025-06-10T12:00:00Z')
$Drive=[PSCustomObject]@{started_at=$Start.ToUnixTimeSeconds();ended_at=$Start.AddMinutes(30).ToUnixTimeSeconds()}
$Tracks=@(
    New-Track $Start.AddMinutes(5).ToUnixTimeSeconds() 'Direct' 'Artist'
    New-Track $Start.AddMinutes(32).ToUnixTimeSeconds() 'Boundary' 'Artist'
    New-Track $Start.AddHours(2).ToUnixTimeSeconds() 'Outside' 'Artist'
    New-Track $Start.AddMinutes(10).ToUnixTimeSeconds() 'Spotify Twin' 'Artist'
)
$ExistingHistory=@([PSCustomObject]@{id='spotify';source='spotify';track='Spotify Twin';artist='Artist';played_at=$Start.AddMinutes(9).ToString('o');duration_ms=180000})
$Plan=New-DriveOSLastFmImportPlan -Tracks $Tracks -Drives @($Drive) -ExistingHistory $ExistingHistory -ExistingSoundtracks @() -Username 'tester' -RangeFromUtc ([DateTimeOffset]::Parse('2025-06-01T00:00:00Z')) -RangeToUtc ([DateTimeOffset]::Parse('2025-07-01T00:00:00Z'))
Assert-True ($Plan.matchedPlays -eq 2) 'Direct and unambiguous boundary scrobbles were not matched.'
Assert-True ($Plan.directMatches -eq 1 -and $Plan.boundaryMatches -eq 1) 'Match confidence buckets are incorrect.'
Assert-True ($Plan.existingDuplicates -eq 1) 'Spotify-first duplicate handling failed.'
Assert-True ($Plan.noDriveMatch -eq 1) 'An unrelated scrobble was assigned to a drive.'
Assert-True ($Plan.affectedDrives -eq 1) 'The plan did not create one affected soundtrack projection.'
Assert-True ($Plan.soundtrackRecords[0].songCount -eq @($Plan.soundtrackRecords[0].songs).Count) 'Soundtrack songCount is inconsistent.'

$OverlapDrive=[PSCustomObject]@{started_at=$Start.AddMinutes(25).ToUnixTimeSeconds();ended_at=$Start.AddMinutes(40).ToUnixTimeSeconds()}
$Ambiguous=New-DriveOSLastFmImportPlan -Tracks @(New-Track $Start.AddMinutes(27).ToUnixTimeSeconds()) -Drives @($Drive,$OverlapDrive) -Username 'tester' -RangeFromUtc $Start.AddDays(-1) -RangeToUtc $Start.AddDays(1)
Assert-True ($Ambiguous.ambiguousMatches -eq 1 -and $Ambiguous.matchedPlays -eq 0) 'Ambiguous drive matches must not be imported.'

$Script=Get-Content (Join-Path $Root 'tools\Import-LastFmDriveHistory.ps1') -Raw
Assert-True ($Script -match "FromDate='2025-06-01" -and $Script -match "will not retrieve listening history before June 1, 2025") 'The importer does not enforce the requested June 2025 cutoff.'
Assert-True ($Script -match '\[switch\]\$Apply' -and $Script -match 'mode=if\(\$Apply\)') 'The importer is not dry-run by default.'
Assert-True ($Script -match 'nextPage' -and $Script -match '\.state\.json') 'The Last.fm fetch is not resumable.'
Write-Host 'JourneyDeck one-time Last.fm import checks passed.' -ForegroundColor Green
