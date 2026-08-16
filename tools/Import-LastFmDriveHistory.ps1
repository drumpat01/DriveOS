param(
    [string]$Username=$env:LASTFM_USERNAME,
    [string]$ApiKey=$env:LASTFM_API_KEY,
    [string]$FromDate='2025-06-01T00:00:00-05:00',
    [string]$ToDate='',
    [ValidateRange(0,15)][int]$BoundaryToleranceMinutes=5,
    [string]$CachePath='',
    [switch]$Restart,
    [switch]$Apply,
    [switch]$UseDesktopSecrets
)

$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot

# Keep the API key out of command history. The repository's ignored .env file
# may provide the two one-time import values without ever committing them.
$EnvPath=Join-Path $Root '.env'
if(([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($ApiKey)) -and (Test-Path -LiteralPath $EnvPath -PathType Leaf)){
    foreach($Line in @(Get-Content -LiteralPath $EnvPath)){
        if($Line -match '^\s*(LASTFM_USERNAME|LASTFM_API_KEY)\s*=\s*(.*?)\s*$'){
            $Value="$($Matches[2])".Trim().Trim('"').Trim("'")
            if($Matches[1] -eq 'LASTFM_USERNAME' -and [string]::IsNullOrWhiteSpace($Username)){$Username=$Value}
            if($Matches[1] -eq 'LASTFM_API_KEY' -and [string]::IsNullOrWhiteSpace($ApiKey)){$ApiKey=$Value}
        }
    }
}
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.LastFmImport.psm1') -Force

if ([string]::IsNullOrWhiteSpace($Username)) { throw 'Username is required. Pass -Username or set LASTFM_USERNAME.' }
if ([string]::IsNullOrWhiteSpace($ApiKey)) { throw 'ApiKey is required. Pass -ApiKey or set LASTFM_API_KEY.' }

$RangeFrom=[DateTimeOffset]::MinValue
if(-not [DateTimeOffset]::TryParse($FromDate,[ref]$RangeFrom)){throw 'FromDate must be a valid date or timestamp.'}
$RangeTo=if($ToDate){
    $Parsed=[DateTimeOffset]::MinValue
    if(-not [DateTimeOffset]::TryParse($ToDate,[ref]$Parsed)){throw 'ToDate must be a valid date or timestamp.'}
    $Parsed
}else{[DateTimeOffset]::UtcNow}
if($RangeTo -le $RangeFrom){throw 'ToDate must be after FromDate.'}
if($RangeFrom -lt [DateTimeOffset]::Parse('2025-06-01T00:00:00-05:00')){throw 'This importer will not retrieve listening history before June 1, 2025.'}

if(-not $CachePath){$CachePath=Join-Path $Root 'data\lastfm-one-time-import.json'}
$StatePath="$CachePath.state.json"
if($Restart){
    foreach($Path in @($CachePath,$StatePath)){if(Test-Path -LiteralPath $Path){Remove-Item -LiteralPath $Path -Force}}
}

$State=$null
if(Test-Path -LiteralPath $StatePath){$State=Get-Content -LiteralPath $StatePath -Raw|ConvertFrom-Json}
$ExpectedFrom=$RangeFrom.ToUniversalTime().ToUnixTimeSeconds()
$ExpectedTo=$RangeTo.ToUniversalTime().ToUnixTimeSeconds()
if($State -and ($State.username -ne $Username -or [long]$State.from -ne $ExpectedFrom)){
    throw 'The resumable cache belongs to a different Last.fm user or date range. Use -Restart to replace it.'
}
if(-not $State){
    $State=[PSCustomObject]@{username=$Username;from=$ExpectedFrom;to=$ExpectedTo;nextPage=1;totalPages=$null;completed=$false;updatedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')}
    @()|ConvertTo-Json|Set-Content -LiteralPath $CachePath -Encoding utf8
}

$Tracks=@()
if(Test-Path -LiteralPath $CachePath){
    $Cached=Get-Content -LiteralPath $CachePath -Raw
    if(-not [string]::IsNullOrWhiteSpace($Cached)){$Tracks=@($Cached|ConvertFrom-Json)}
}

while(-not [bool]$State.completed){
    $Query=@{
        method='user.getrecenttracks';user=$Username;api_key=$ApiKey;format='json';limit=200
        page=[int]$State.nextPage;from=[long]$State.from;to=[long]$State.to
    }
    $Response=Invoke-RestMethod -Method Get -Uri 'https://ws.audioscrobbler.com/2.0/' -Body $Query
    if($Response.error){throw "Last.fm API error $($Response.error): $($Response.message)"}
    $PageTracks=@($Response.recenttracks.track|Where-Object{$null -ne $_ -and $_.date})
    $Tracks=@($Tracks+$PageTracks)
    $Tracks|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $CachePath -Encoding utf8
    $Meta=$Response.recenttracks.'@attr'
    $State.totalPages=[int]$Meta.totalPages
    $State.nextPage=[int]$State.nextPage+1
    $State.completed=([int]$State.nextPage -gt [int]$State.totalPages -or $PageTracks.Count -eq 0)
    $State.updatedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
    $State|ConvertTo-Json|Set-Content -LiteralPath $StatePath -Encoding utf8
    Write-Host "Fetched Last.fm page $([int]$State.nextPage-1) of $($State.totalPages); $($Tracks.Count) scrobbles cached."
}

if ($UseDesktopSecrets -or ($Apply -and (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN))) {
    Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
    $SecretPath=Join-Path $Root 'data\driveos-secrets.json'
    if (-not (Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'Desktop secrets are unavailable.' }
    $Secrets=Get-Content -LiteralPath $SecretPath -Raw|ConvertFrom-Json
    $env:TURSO_DATABASE_URL=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop
    $env:TURSO_AUTH_TOKEN=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop
}

$Repository=New-DriveOSRepository -DataDirectory ([IO.Path]::GetTempPath()) -AppRoot $Root -Provider Turso
$Drives=@(Get-DriveOSTessieDrives -Repository $Repository -Days 730)
$History=@(Get-DriveOSListeningHistory -Repository $Repository)
$Soundtracks=@(Get-DriveOSDriveSoundtracks -Repository $Repository)
$Plan=New-DriveOSLastFmImportPlan -Tracks $Tracks -Drives $Drives -ExistingHistory $History -ExistingSoundtracks $Soundtracks -Username $Username -RangeFromUtc $RangeFrom -RangeToUtc $RangeTo -BoundaryToleranceMinutes $BoundaryToleranceMinutes

$PersistedHistory=0
$PersistedSoundtracks=0
if($Apply){
    foreach($Record in @($Plan.historyRecords)){Add-DriveOSListeningHistoryRecord -Repository $Repository -Record $Record;$PersistedHistory++}
    foreach($Record in @($Plan.soundtrackRecords)){Set-DriveOSDriveSoundtrack -Repository $Repository -Record $Record;$PersistedSoundtracks++}
    Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'lastfm-one-time-import' -Record ([PSCustomObject]@{
        status='completed';username=$Username;rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc
        matchedPlays=$PersistedHistory;affectedDrives=$PersistedSoundtracks;completedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
    })
}

[PSCustomObject]@{
    mode=if($Apply){'apply'}else{'dry-run'}
    rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc
    tracksSeen=$Plan.tracksSeen;outsideRangeOrInvalid=$Plan.outsideRangeOrInvalid
    existingDuplicates=$Plan.existingDuplicates;noDriveMatch=$Plan.noDriveMatch;ambiguousMatches=$Plan.ambiguousMatches
    directMatches=$Plan.directMatches;boundaryMatches=$Plan.boundaryMatches
    matchedPlays=$Plan.matchedPlays;affectedDrives=$Plan.affectedDrives
    persistedHistory=$PersistedHistory;persistedSoundtracks=$PersistedSoundtracks
}|ConvertTo-Json -Depth 5
