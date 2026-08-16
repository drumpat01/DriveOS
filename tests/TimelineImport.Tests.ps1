$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TimelineImport.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
$Scratch=Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-timeline-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Scratch | Out-Null
try{
    $Input=Join-Path $Scratch 'location-history.json'
    @(
        [ordered]@{startTime='2026-01-31T23:55:00Z';endTime='2026-02-01T00:05:00Z';activity=[ordered]@{topCandidate=[ordered]@{type='in passenger vehicle';probability='0.99'};start='geo:32.0,-97.0';end='geo:32.1,-97.1';distanceMeters='1000'}},
        [ordered]@{startTime='2026-03-01T08:00:00-06:00';endTime='2026-03-01T08:20:00-06:00';activity=[ordered]@{topCandidate=[ordered]@{type='in passenger vehicle';probability='0.95'};start='geo:32.1,-97.1';end='geo:32.2,-97.2';distanceMeters='16093.44'}},
        [ordered]@{startTime='2026-03-02T08:00:00-06:00';endTime='2026-03-02T08:10:00-06:00';activity=[ordered]@{topCandidate=[ordered]@{type='in passenger vehicle';probability='0.40'};start='geo:32.2,-97.2';end='geo:32.3,-97.3';distanceMeters='1000'}}
    ) | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Input -Encoding UTF8
    $Plan=New-DriveOSTimelineImportPlan -InputPath $Input -RangeFrom ([DateTimeOffset]'2026-02-01T00:00:00Z') -RangeTo ([DateTimeOffset]'2026-04-01T00:00:00Z') -MinimumConfidence .8
    Assert-True ($Plan.candidateCount -eq 1 -and $Plan.rejectedForConfidence -eq 1) 'Timeline confidence filtering failed.'
    Assert-True ($Plan.passengerSegmentsSeen -eq 2) 'Timeline import included a drive that started before the hard lower boundary.'
    Assert-True ([math]::Abs($Plan.totalMiles-10) -lt .01) 'Timeline distance conversion failed.'
    $Repo=New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider SQLite
    Initialize-DriveOSSqlite -Repository $Repo
    $null=Save-DriveOSReconstructedDrives -Repository $Repo -Plan $Plan
    $Rows=@(Get-DriveOSTessieDrives -Repository $Repo -Days 730)
    Assert-True ($Rows.Count -eq 1 -and $Rows[0].source -eq 'google_timeline' -and $Rows[0].reconstructed) 'Reconstructed drives do not round-trip through durable history.'
    $Rerun=New-DriveOSTimelineImportPlan -InputPath $Input -RangeFrom ([DateTimeOffset]'2026-02-01T00:00:00Z') -RangeTo ([DateTimeOffset]'2026-04-01T00:00:00Z') -MinimumConfidence .8 -ExistingDrives $Rows
    Assert-True ($Rerun.candidateCount -eq 0 -and $Rerun.rejectedForOverlap -eq 1) 'Timeline import is not safely resumable.'
}finally{if(Test-Path -LiteralPath $Scratch){Remove-Item -LiteralPath $Scratch -Recurse -Force}}
Write-Host 'Google Timeline import checks passed.' -ForegroundColor Green
