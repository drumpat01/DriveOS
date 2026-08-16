$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }
function Assert-Equal { param($Actual,$Expected,[string]$Message) if ($Actual -ne $Expected) { throw "$Message Expected '$Expected', received '$Actual'." } }

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseInput($Server,[ref]$Tokens,[ref]$ParseErrors)
Assert-Equal $ParseErrors.Count 0 'DriveOS server must parse before the backfill state machine can be tested.'

foreach ($FunctionName in @('Get-SpotifyPageBeforeCursor','New-SoundtrackBackfillState','Invoke-SoundtrackBackfillStep')) {
    $FunctionAst = $Ast.Find({
        param($Node)
        $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq $FunctionName
    },$true)
    Assert-True ($null -ne $FunctionAst) "Missing server function $FunctionName."
    Invoke-Expression $FunctionAst.Extent.Text
}

$script:BackfillState = $null
$script:ProjectedDriveIds = [System.Collections.Generic.List[string]]::new()
$script:DriveDataCache = [PSCustomObject]@{
    drives730 = @('stale'); drives730ExpiresAt = [DateTimeOffset]::UtcNow
    dashboardDrives = @('stale'); dashboardDrivesExpiresAt = [DateTimeOffset]::UtcNow
    wifeDrives = @('stale'); wifeDrivesExpiresAt = [DateTimeOffset]::UtcNow
}

function Get-SoundtrackBackfillState { return $script:BackfillState }
function Save-SoundtrackBackfillState { param($State) $script:BackfillState = $State }
function Get-SpotifyRecentPage {
    param($Limit,$Before)
    if ("$Before" -eq '9000') {
        return [PSCustomObject]@{ items = @([PSCustomObject]@{ id = 'older-play' }); cursors = [PSCustomObject]@{ before = '8000' } }
    }
    if ("$Before" -eq '8000') {
        return [PSCustomObject]@{ items = @(); cursors = [PSCustomObject]@{ before = $null } }
    }
    throw "Unexpected Spotify cursor: $Before"
}
function Save-SpotifyHistory { param($Items) return @($Items).Count }
function Get-RawDrives {
    param($Days)
    return @(
        [PSCustomObject]@{ started_at = 1000; ended_at = 1100 },
        [PSCustomObject]@{ started_at = 2000; ended_at = 2100 },
        [PSCustomObject]@{ started_at = 3000; ended_at = 3100 }
    )
}
function Get-SpotifyHistory { return @() }
function Get-CanonicalDriveSoundtrack {
    param($DriveId,$DriveStart,$DriveEnd,$SpotifyHistory,[switch]$Reconcile,[switch]$ForcePersist)
    $script:ProjectedDriveIds.Add("$DriveId")
    return @()
}

$First = Invoke-SoundtrackBackfillStep -InitialBefore '9000' -MaxSpotifyPages 1 -DriveBatchSize 2
Assert-Equal $First.spotifyPagesFetchedThisRun 1 'The first step should archive one historical Spotify page.'
Assert-Equal $First.spotifyPlaysArchivedThisRun 1 'The historical Spotify play was not archived.'
Assert-Equal $First.drivesProcessedThisRun 0 'Projection must wait until Spotify pagination reaches the archive boundary.'
Assert-Equal $script:BackfillState.spotifyBefore '8000' 'The next Spotify cursor was not persisted for resume.'

$Second = Invoke-SoundtrackBackfillStep -InitialBefore 'ignored' -MaxSpotifyPages 1 -DriveBatchSize 2
Assert-Equal $Second.drivesProcessedThisRun 2 'The first projection batch should process exactly two drives.'
Assert-Equal $Second.remainingDrives 1 'The exact remaining projection set was not persisted.'
Assert-Equal $script:BackfillState.status 'running' 'The backfill completed before the pending drive set was exhausted.'

$Third = Invoke-SoundtrackBackfillStep -InitialBefore 'ignored' -MaxSpotifyPages 1 -DriveBatchSize 2
Assert-Equal $Third.drivesProcessedThisRun 1 'The resumed projection did not process the final drive.'
Assert-Equal $Third.remainingDrives 0 'The completed backfill still has pending drives.'
Assert-Equal $script:BackfillState.status 'completed' 'The backfill was not marked complete.'
Assert-Equal (@($script:ProjectedDriveIds | Select-Object -Unique).Count) 3 'Each retained drive must receive a canonical soundtrack projection.'
Assert-True ($null -eq $script:DriveDataCache.drives730) 'The repaired drive snapshot cache was not invalidated.'

$NoOp = Invoke-SoundtrackBackfillStep -InitialBefore 'ignored' -MaxSpotifyPages 1 -DriveBatchSize 2
Assert-Equal $NoOp.drivesProcessedThisRun 0 'A completed backfill must be safe to rerun.'
Assert-Equal $script:ProjectedDriveIds.Count 3 'A completed backfill unexpectedly projected drives again.'

Write-Host 'DriveOS resumable soundtrack backfill checks passed.' -ForegroundColor Green
