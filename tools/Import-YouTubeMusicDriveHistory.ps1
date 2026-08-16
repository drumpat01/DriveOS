param(
    [Parameter(Mandatory=$true)][string]$InputDirectory,
    [string]$FromDate='2025-06-01T00:00:00-05:00',[string]$ToDate='',
    [ValidateRange(0,15)][int]$BoundaryReviewMinutes=5,
    [switch]$IncludeBoundaryMatches,[switch]$Apply,[switch]$UseDesktopSecrets
)
$ErrorActionPreference='Stop';$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.YouTubeMusicImport.psm1') -Force
$Resolved=(Resolve-Path -LiteralPath $InputDirectory).Path;$RangeFrom=[DateTimeOffset]::Parse($FromDate);$RangeTo=if($ToDate){[DateTimeOffset]::Parse($ToDate)}else{[DateTimeOffset]::UtcNow}
if($RangeFrom-lt[DateTimeOffset]::Parse('2025-06-01T00:00:00-05:00')){throw 'This importer will not retrieve listening history before June 1, 2025.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem;$EntryName='Takeout/YouTube and YouTube Music/history/watch-history.html';$Found=@()
foreach($Zip in @(Get-ChildItem -LiteralPath $Resolved -File -Filter '*.zip')){$Archive=[IO.Compression.ZipFile]::OpenRead($Zip.FullName);try{$Entry=$Archive.GetEntry($EntryName);if($Entry){$Found+=[pscustomobject]@{zip=$Zip.FullName;entry=$EntryName}}}finally{$Archive.Dispose()}}
if($Found.Count-ne1){throw "Expected exactly one YouTube watch-history entry, found $($Found.Count)."}
$Archive=[IO.Compression.ZipFile]::OpenRead($Found[0].zip);try{$Entry=$Archive.GetEntry($EntryName);$Reader=[IO.StreamReader]::new($Entry.Open());try{$Html=$Reader.ReadToEnd()}finally{$Reader.Dispose()}}finally{$Archive.Dispose()}
$Records=@(ConvertFrom-DriveOSYouTubeMusicTakeoutHtml $Html)
if($UseDesktopSecrets-or($Apply-and(-not$env:TURSO_DATABASE_URL-or-not$env:TURSO_AUTH_TOKEN))){Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force;$SecretPath=Join-Path $Root 'data\driveos-secrets.json';$Secrets=Get-Content -LiteralPath $SecretPath -Raw|ConvertFrom-Json;$env:TURSO_DATABASE_URL=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop;$env:TURSO_AUTH_TOKEN=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop}
$Repository=New-DriveOSRepository -DataDirectory ([IO.Path]::GetTempPath()) -AppRoot $Root -Provider Turso
$Plan=New-DriveOSYouTubeMusicImportPlan -Records $Records -Drives @(Get-DriveOSTessieDrives -Repository $Repository -Days 730) -ExistingHistory @(Get-DriveOSListeningHistory -Repository $Repository) -ExistingSoundtracks @(Get-DriveOSDriveSoundtracks -Repository $Repository) -RangeFromUtc $RangeFrom -RangeToUtc $RangeTo -BoundaryReviewMinutes $BoundaryReviewMinutes -IncludeBoundaryMatches:$IncludeBoundaryMatches
$Written=0;$Projected=0;if($Apply){foreach($Record in $Plan.historyRecords){Add-DriveOSListeningHistoryRecord -Repository $Repository -Record $Record;$Written++};foreach($Record in $Plan.soundtrackRecords){Set-DriveOSDriveSoundtrack -Repository $Repository -Record $Record;$Projected++};Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider 'youtube-music-one-time-import' -Record ([pscustomobject]@{status='completed';rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc;matchedPlays=$Written;affectedDrives=$Projected;boundaryMatchesIncluded=[bool]$IncludeBoundaryMatches;completedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')})}
[pscustomobject]@{mode=if($Apply){'apply'}else{'dry-run'};archive=$Found[0].zip;rangeFromUtc=$Plan.rangeFromUtc;rangeToUtc=$Plan.rangeToUtc;recordsSeen=$Plan.recordsSeen;outsideRange=$Plan.outsideRange;existingDuplicates=$Plan.existingDuplicates;alreadyImported=$Plan.alreadyImported;noDriveMatch=$Plan.noDriveMatch;ambiguousMatches=$Plan.ambiguousMatches;directMatches=$Plan.directMatches;boundaryReviewMatches=$Plan.boundaryReviewMatches;boundaryMatchesIncluded=[bool]$IncludeBoundaryMatches;matchedPlays=$Plan.matchedPlays;newHistoryRecords=$Plan.newHistoryRecords;affectedDrives=$Plan.affectedDrives;persistedHistory=$Written;persistedSoundtracks=$Projected}|ConvertTo-Json -Depth 4
