$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Drives\DriveOS.Drives.psm1') -Force

$RawDriveModel = [PSCustomObject]@{
    started_at=100; ended_at=200; starting_battery=80; ending_battery=79
    odometer_distance=1; energy_used=.25; average_speed=20; max_speed=30
    starting_location='Start'; ending_location='End'
}
$NullSafeModel = ConvertTo-DriveOSDrive -Drive $RawDriveModel -Soundtrack @($null)
Assert-True ($NullSafeModel.songCount -eq 0) 'A null soundtrack entry still creates a phantom song count.'
Assert-True (@($NullSafeModel.soundtrack).Count -eq 0) 'A null soundtrack entry still reaches the public payload.'
$ConsistentModel = ConvertTo-DriveOSDrive -Drive $RawDriveModel -Soundtrack @($null,[PSCustomObject]@{track='Real song'})
Assert-True ($ConsistentModel.songCount -eq @($ConsistentModel.soundtrack).Count) 'Public songCount no longer equals soundtrack length.'

$TestDirectory = Join-Path $env:TEMP "driveos-soundtrack-$([Guid]::NewGuid().ToString('N'))"
try {
    $Repository = New-DriveOSRepository -DataDirectory $TestDirectory -Provider Json
    $First = [PSCustomObject]@{ version=1; driveId='100-200'; startedAt='2026-08-13T10:00:00Z'; endedAt='2026-08-13T11:00:00Z'; status='pending'; songCount=1; songs=@([PSCustomObject]@{ track='First'; playedAt='2026-08-13T10:05:00Z' }) }
    $Final = [PSCustomObject]@{ version=1; driveId='100-200'; startedAt='2026-08-13T10:00:00Z'; endedAt='2026-08-13T11:00:00Z'; status='finalized'; songCount=2; songs=@([PSCustomObject]@{ track='First'; playedAt='2026-08-13T10:05:00Z' },[PSCustomObject]@{ track='Late sync'; playedAt='2026-08-13T10:35:00Z' }) }

    Set-DriveOSDriveSoundtrack -Repository $Repository -Record $First
    Set-DriveOSDriveSoundtrack -Repository $Repository -Record $Final
    $Records = @(Get-DriveOSDriveSoundtracks -Repository $Repository)

    Assert-True ($Records.Count -eq 1) 'Soundtrack upsert created more than one record for a drive.'
    Assert-True ($Records[0].status -eq 'finalized') 'A reconciled drive did not replace its pending record.'
    Assert-True ($Records[0].songs.Count -eq 2) 'A delayed Spotify play did not survive soundtrack reconciliation.'
}
finally {
    if (Test-Path -LiteralPath $TestDirectory) { Remove-Item -LiteralPath $TestDirectory -Recurse -Force }
}

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
Assert-True ($Server -match 'Get-CanonicalDriveSoundtrack') 'Canonical soundtrack resolver is missing.'
Assert-True ($Server -match 'Get-CachedDriveSoundtrack') 'Read-only soundtrack cache accessor is missing.'
Assert-True ($Server -match 'Invoke-ScheduledSpotifySync[\s\S]+Update-RecentDriveSoundtrackCache -Days 1') 'Scheduled Spotify sync does not reconcile recent drive soundtracks.'
Assert-True ($Server -match 'Invoke-ScheduledSpotifySync[\s\S]+Invoke-SoundtrackBackfillStep') 'Scheduled Spotify sync does not advance the resumable historical backfill.'

$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseInput($Server,[ref]$Tokens,[ref]$ParseErrors)
Assert-True ($ParseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'
foreach ($FunctionName in @('Get-SoundtrackForWindow','Get-DriveSoundtrackRecordMap','Save-DriveSoundtrackRecord','Get-CachedDriveSoundtrack','Get-CanonicalDriveSoundtrack')) {
    $FunctionAst = $Ast.Find({ param($Node) $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq $FunctionName },$true)
    Assert-True ($null -ne $FunctionAst) "Missing runtime function: $FunctionName"
    Invoke-Expression $FunctionAst.Extent.Text
}

$MapFunction = $Ast.Find({
    param($Node)
    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-DriveMapData'
},$true).Extent.Text
$ReconcileFunction = $Ast.Find({
    param($Node)
    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Update-RecentDriveSoundtrackCache'
},$true).Extent.Text
Assert-True ($MapFunction -match 'Get-CachedDriveSoundtrack') 'Drive maps do not use the read-only shared soundtrack cache.'
Assert-True ($MapFunction -notmatch 'Get-SpotifyHistory|Get-CanonicalDriveSoundtrack|Save-DriveSoundtrackRecord') 'Drive maps can still load, reconcile, or write soundtrack history.'
Assert-True ($ReconcileFunction -match 'Get-CanonicalDriveSoundtrack[\s\S]+-Reconcile[\s\S]+-ForcePersist') 'Background sync no longer owns durable soundtrack reconciliation.'
$CanonicalCalls = @($Ast.FindAll({
    param($Node)
    $Node -is [System.Management.Automation.Language.CommandAst] -and $Node.GetCommandName() -eq 'Get-CanonicalDriveSoundtrack'
},$true))
Assert-True ($CanonicalCalls.Count -eq 2) 'Canonical soundtrack reconciliation must stay inside the two background workers.'
$CanonicalParents = @($CanonicalCalls | ForEach-Object {
    $Parent = $_.Parent
    while ($Parent -and $Parent -isnot [System.Management.Automation.Language.FunctionDefinitionAst]) { $Parent = $Parent.Parent }
    $Parent.Name
})
Assert-True (@($CanonicalParents | Sort-Object -Unique).Count -eq 2) 'Canonical soundtrack reconciliation escaped or duplicated a background worker.'
Assert-True ($CanonicalParents -contains 'Update-RecentDriveSoundtrackCache') 'Recent soundtrack reconciliation is no longer background-owned.'
Assert-True ($CanonicalParents -contains 'Invoke-SoundtrackBackfillStep') 'Historical soundtrack reconciliation is no longer background-owned.'

$script:DriveSoundtrackRecordsMemory = @{}
$script:DriveSoundtrackRecordsLoaded = $true
$script:SavedSoundtrack = $null
$Repository = [PSCustomObject]@{ Provider='Json' }
function Get-DriveOSDriveSoundtracks { @() }
function Set-DriveOSDriveSoundtrack { param($Repository,$Record) $script:SavedSoundtrack=$Record }
function ConvertTo-DriveOSDisplayTime { param($Value) return $Value.ToLocalTime() }
function Get-SpotifyRecordTrackId { param($Record) return $Record.track_id }

$script:DriveSoundtrackRecordsMemory['cached-drive'] = [PSCustomObject]@{
    driveId = 'cached-drive'
    songs = @($null, [PSCustomObject]@{ track='Stored'; playedAt='2026-08-13T10:05:00Z' })
}
$CachedSongs = @(Get-CachedDriveSoundtrack -DriveId 'cached-drive')
$MissingSongs = @(Get-CachedDriveSoundtrack -DriveId 'missing-drive')
Assert-True ($CachedSongs.Count -eq 1 -and $CachedSongs[0].track -eq 'Stored') 'Read-only cache did not return the stored soundtrack payload.'
Assert-True ($null -notin $CachedSongs) 'Read-only cache exposed a null legacy soundtrack entry.'
Assert-True ($MissingSongs.Count -eq 0) 'A missing cached soundtrack did not return an empty song list.'

$RecentEnd = [DateTimeOffset]::UtcNow.AddMinutes(-30)
$RecentStart = $RecentEnd.AddMinutes(-60)
$History = @([PSCustomObject]@{ played_at=$RecentStart.AddMinutes(5).ToString('o'); duration_ms=180000; track='First'; artist='Artist'; album='Album'; track_id='one'; track_uri='spotify:track:one'; album_image='https://i.scdn.co/image/one'; spotify_url='https://open.spotify.com/track/one'; album_spotify_url='https://open.spotify.com/album/one' })
$PendingSongs = @(Get-CanonicalDriveSoundtrack -DriveId 'recent-drive' -DriveStart $RecentStart -DriveEnd $RecentEnd -SpotifyHistory $History -Reconcile -ForcePersist)
Assert-True ($PendingSongs.Count -eq 1) 'Canonical cache did not match the first drive song.'
Assert-True ($script:SavedSoundtrack.status -eq 'pending') 'A recent drive was finalized before Spotify could catch up.'

$History += [PSCustomObject]@{ played_at=$RecentStart.AddMinutes(40).ToString('o'); duration_ms=180000; track='Late sync'; artist='Artist'; album='Album'; track_id='two'; track_uri='spotify:track:two'; album_image='https://i.scdn.co/image/two'; spotify_url='https://open.spotify.com/track/two'; album_spotify_url='https://open.spotify.com/album/two' }
$ReconciledSongs = @(Get-CanonicalDriveSoundtrack -DriveId 'recent-drive' -DriveStart $RecentStart -DriveEnd $RecentEnd -SpotifyHistory $History -Reconcile -ForcePersist)
Assert-True ($ReconciledSongs.Count -eq 2) 'A delayed Spotify play did not repair the pending drive soundtrack.'

Write-Host 'Shared drive soundtrack cache checks passed.' -ForegroundColor Green
