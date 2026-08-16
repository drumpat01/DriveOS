param(
    [Parameter(Mandatory=$true)][string]$ArchivePath,
    [string]$FromDate='2025-06-01T00:00:00-05:00',[string]$ToDate='',
    [ValidateRange(1000,300000)][long]$MinimumPlayedMs=30000,
    [ValidateRange(1000,300000)][long]$MinimumDriveOverlapMs=15000,
    [ValidateRange(0,20)][int]$PreviewRecordCount=0,
    [switch]$Apply,[switch]$UseDesktopSecrets
)
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.SpotifyExtendedImport.psm1') -Force
$Resolved=(Resolve-Path -LiteralPath $ArchivePath).Path; $RangeFrom=[DateTimeOffset]::Parse($FromDate); $RangeTo=if($ToDate){[DateTimeOffset]::Parse($ToDate)}else{[DateTimeOffset]::UtcNow}
if($RangeFrom-lt[DateTimeOffset]::Parse('2025-06-01T00:00:00-05:00')){throw 'This importer will not retrieve listening history before June 1, 2025.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem; $Archive=[IO.Compression.ZipFile]::OpenRead($Resolved); $Entries=New-Object Collections.ArrayList
try {
    $AudioFiles=@($Archive.Entries|Where-Object{$_.Name-like'Streaming_History_Audio_*.json'})
    if($AudioFiles.Count-eq0){throw 'No Spotify extended audio history files were found in the archive.'}
    foreach($File in $AudioFiles){$Reader=[IO.StreamReader]::new($File.Open());try{$Rows=$Reader.ReadToEnd()|ConvertFrom-Json;foreach($Row in [object[]]$Rows){[void]$Entries.Add($Row)}}finally{$Reader.Dispose()}}
} finally {$Archive.Dispose()}
if($UseDesktopSecrets-or($Apply-and(-not$env:TURSO_DATABASE_URL-or-not$env:TURSO_AUTH_TOKEN))){Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force;$Secrets=Get-Content -LiteralPath (Join-Path $Root 'data\driveos-secrets.json') -Raw|ConvertFrom-Json;$env:TURSO_DATABASE_URL=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop;$env:TURSO_AUTH_TOKEN=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop}
$Repository=New-DriveOSRepository -DataDirectory ([IO.Path]::GetTempPath()) -AppRoot $Root -Provider Turso
$Plan=New-DriveOSSpotifyExtendedImportPlan -Entries @($Entries) -Drives @(Get-DriveOSTessieDrives -Repository $Repository -Days 730) -ExistingHistory @(Get-DriveOSListeningHistory -Repository $Repository) -ExistingSoundtracks @(Get-DriveOSDriveSoundtracks -Repository $Repository) -RangeFromUtc $RangeFrom -RangeToUtc $RangeTo -MinimumPlayedMs $MinimumPlayedMs -MinimumDriveOverlapMs $MinimumDriveOverlapMs
$Written=0;$Projected=0;if($Apply){Add-DriveOSTursoHistoryRecords -Repository $Repository -Records @($Plan.historyRecords);$Written=$Plan.historyRecords.Count;Set-DriveOSTursoSoundtracks -Repository $Repository -Records @($Plan.soundtrackRecords);$Projected=$Plan.soundtrackRecords.Count;Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'spotify-extended-one-time-import' -Record ([pscustomobject]@{status='completed';rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc;matchedPlays=$Plan.matchedPlays;newHistoryRecords=$Written;affectedDrives=$Projected;minimumPlayedMs=$MinimumPlayedMs;minimumDriveOverlapMs=$MinimumDriveOverlapMs;completedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')})}
$Preview=if($PreviewRecordCount-gt0){@($Plan.historyRecords|Select-Object -First $PreviewRecordCount id,played_at,track,artist,album)}else{@()}
[pscustomobject]@{mode=if($Apply){'apply'}else{'dry-run'};archive=$Resolved;rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc;entriesSeen=$Plan.entriesSeen;invalidOrNonTrack=$Plan.invalidOrNonTrack;outsideRange=$Plan.outsideRange;shortPlays=$Plan.shortPlays;exactDuplicates=$Plan.exactDuplicates;crossProviderMatches=$Plan.crossProviderMatches;noDriveMatch=$Plan.noDriveMatch;ambiguousMatches=$Plan.ambiguousMatches;matchedPlays=$Plan.matchedPlays;newHistoryRecords=$Plan.newHistoryRecords;affectedDrives=$Plan.affectedDrives;persistedHistory=$Written;persistedSoundtracks=$Projected;previewRecords=$Preview}|ConvertTo-Json -Depth 4
