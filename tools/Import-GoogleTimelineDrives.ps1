param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [ValidateRange(1,24)][int]$Months=6,
    [string]$FromDate='',
    [ValidateRange(0,1)][double]$MinimumConfidence=.8,
    [switch]$Apply,
    [switch]$UseDesktopSecrets
)

$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TimelineImport.psm1') -Force

if ($UseDesktopSecrets -or ($Apply -and (-not $env:TURSO_DATABASE_URL -or -not $env:TURSO_AUTH_TOKEN))) {
    Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
    $SecretPath=Join-Path $Root 'data\driveos-secrets.json'
    if (-not (Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'Desktop secrets are unavailable.' }
    $Secrets=Get-Content -LiteralPath $SecretPath -Raw | ConvertFrom-Json
    $env:TURSO_DATABASE_URL=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop
    $env:TURSO_AUTH_TOKEN=Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop
}

$Repository=New-DriveOSRepository -DataDirectory ([IO.Path]::GetTempPath()) -AppRoot $Root -Provider Turso
$Existing=@(Get-DriveOSTessieDrives -Repository $Repository -Days 730)
$RangeTo=[DateTimeOffset]::UtcNow
$RangeFrom=if($FromDate){
    $Parsed=[DateTimeOffset]::MinValue
    if(-not [DateTimeOffset]::TryParse($FromDate,[ref]$Parsed)){throw 'FromDate must be a valid date or timestamp.'}
    $Parsed
}else{$RangeTo.AddMonths(-$Months)}
$Plan=New-DriveOSTimelineImportPlan -InputPath $InputPath -RangeFrom $RangeFrom -RangeTo $RangeTo -MinimumConfidence $MinimumConfidence -ExistingDrives $Existing
$Result=[ordered]@{
    mode=if($Apply){'apply'}else{'dry-run'}
    rangeFromUtc=$Plan.rangeFromUtc; rangeToUtc=$Plan.rangeToUtc; minimumConfidence=$MinimumConfidence
    existingDurableDrives=$Existing.Count; passengerSegmentsSeen=$Plan.passengerSegmentsSeen
    rejectedForConfidence=$Plan.rejectedForConfidence; rejectedForOverlap=$Plan.rejectedForOverlap
    candidateCount=$Plan.candidateCount; totalMiles=$Plan.totalMiles; persisted=0
}
if($Apply -and $Plan.candidateCount){
    $Saved=Save-DriveOSReconstructedDrives -Repository $Repository -Plan $Plan
    $Result.persisted=$Saved.records
}
[PSCustomObject]$Result | ConvertTo-Json -Depth 5
