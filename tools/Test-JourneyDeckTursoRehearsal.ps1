param(
    [string]$DatabaseUrl = $env:TURSO_DATABASE_URL,
    [string]$AuthToken = $env:TURSO_AUTH_TOKEN,
    [switch]$ConfirmIsolatedDatabase
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmIsolatedDatabase) { throw 'ConfirmIsolatedDatabase is required; this rehearsal writes synthetic rows.' }
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'An isolated Turso database URL is required.' }
if ([string]::IsNullOrWhiteSpace($AuthToken)) { throw 'An isolated Turso database auth token is required.' }

$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieReadiness.psm1') -Force

function Assert-Rehearsal { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$RunKey = [guid]::NewGuid().ToString('N')
$HouseholdId = "rehearsal_$RunKey"
$Vin = "REHEARSAL$($RunKey.Substring(0,8).ToUpperInvariant())"
$Repository = [PSCustomObject]@{
    Provider = 'Turso'
    TursoDatabaseUrl = $DatabaseUrl
    TursoAuthToken = $AuthToken
}

Initialize-DriveOSTurso -Repository $Repository
Initialize-DriveOSTurso -Repository $Repository
$Versions = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'SELECT version FROM schema_migrations ORDER BY version;')
Assert-Rehearsal ($Versions.Count -ge 2) 'Ordered migrations did not apply idempotently to Turso.'

$Now = [DateTimeOffset]::UtcNow
$Started = $Now.AddHours(-2).ToUnixTimeSeconds()
$Ended = $Now.AddHours(-1).ToUnixTimeSeconds()
$Vehicle = [PSCustomObject]@{ vin=$Vin; last_state=[PSCustomObject]@{ display_name='JourneyDeck rehearsal' } }
$Drive = [PSCustomObject]@{ id="drive-$RunKey"; started_at=$Started; ended_at=$Ended; starting_location='Synthetic A'; ending_location='Synthetic B'; odometer_distance=8.5; energy_used=2.1 }
$Charge = [PSCustomObject]@{ id="charge-$RunKey"; started_at=$Started; ended_at=$Ended; location='Synthetic A'; energy_added=12.5; energy_used=13.0; is_supercharger=$false }

$null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -HouseholdId $HouseholdId
$Drive.ended_at = $Ended + 60
$Drive.energy_used = 2.3
$Charge.ended_at = $Ended + 120
$null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now.AddMinutes(1) -HouseholdId $HouseholdId
$null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now.AddMinutes(1) -HouseholdId $HouseholdId

$Snapshot = New-DriveOSTessieSnapshot -Vehicle $Vehicle -Drives @($Drive) -Charges @($Charge) -RangeToUtc $Now -HouseholdId $HouseholdId
$DriveRows = @(Get-DriveOSTursoTessieAuditRows -Repository $Repository -Resource drives -FromEpoch $Started -ToEpoch $Now.ToUnixTimeSeconds() -VehicleId $Snapshot.vehicle.id)
$ChargeRows = @(Get-DriveOSTursoTessieAuditRows -Repository $Repository -Resource charges -FromEpoch $Started -ToEpoch $Now.ToUnixTimeSeconds() -VehicleId $Snapshot.vehicle.id)
Assert-Rehearsal ($DriveRows.Count -eq 1) 'Retry/correction rehearsal created a duplicate drive.'
Assert-Rehearsal ($ChargeRows.Count -eq 1) 'Retry/correction rehearsal created a duplicate charging session.'
Assert-Rehearsal ([long]$DriveRows[0].ended_at_epoch -eq ($Ended + 60)) 'Turso did not update the corrected drive epoch.'
Assert-Rehearsal ([long]$ChargeRows[0].ended_at_epoch -eq ($Ended + 120)) 'Turso did not update the corrected charging epoch.'
Assert-Rehearsal ([double]$DriveRows[0].energy_used_kwh -eq 2.3) 'Turso did not update corrected normalized drive data.'

$CursorBeforeFailure = Get-DriveOSTursoIntegrationSyncCursor -Repository $Repository -HouseholdId $HouseholdId -Provider tessie -Resource drives
$FailedRun = New-DriveOSIntegrationSyncRun -Provider tessie -Resource drives -RangeFromUtc $Now.AddMinutes(1) -RangeToUtc $Now.AddMinutes(2) -HouseholdId $HouseholdId
$FailedRun.status = 'failed'
$FailedRun.completedAtUtc = $Now.AddMinutes(2).ToString('o')
$FailedRun.errorMessage = 'synthetic rehearsal failure'
Set-DriveOSTursoIntegrationSyncRun -Repository $Repository -Run $FailedRun
$CursorAfterFailure = Get-DriveOSTursoIntegrationSyncCursor -Repository $Repository -HouseholdId $HouseholdId -Provider tessie -Resource drives
Assert-Rehearsal ($CursorAfterFailure.cursor_value -eq $CursorBeforeFailure.cursor_value) 'A failed Turso retry advanced the drive cursor.'
Assert-Rehearsal ($CursorAfterFailure.last_error -eq 'synthetic rehearsal failure') 'A failed Turso retry did not persist its error.'

foreach ($Resource in @('drives','charges')) {
    $SucceededRun = New-DriveOSIntegrationSyncRun -Provider tessie -Resource $Resource -RangeFromUtc $Now -RangeToUtc $Now.AddMinutes(3) -HouseholdId $HouseholdId
    $SucceededRun.status = 'succeeded'
    $SucceededRun.completedAtUtc = $Now.AddMinutes(3).ToString('o')
    if ($Resource -eq 'drives') {
        $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives @($Drive) -RangeToUtc $Now.AddMinutes(3) -HouseholdId $HouseholdId -CompletedResources @('drives') -SyncRun $SucceededRun
    }
    else {
        $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Charges @($Charge) -RangeToUtc $Now.AddMinutes(3) -HouseholdId $HouseholdId -CompletedResources @('charges') -SyncRun $SucceededRun
    }
}

$CursorReader = {
    param($TargetRepository,$Resource)
    Get-DriveOSTursoIntegrationSyncCursor -Repository $TargetRepository -HouseholdId $HouseholdId -Provider tessie -Resource $Resource
}.GetNewClosure()
$Readiness = Assert-JourneyDeckTessieReadReady -Repository $Repository -Now $Now.AddMinutes(3) -CursorReader $CursorReader
Assert-Rehearsal $Readiness.ready 'Fresh Turso cursors did not pass the read-canary activation gate.'
$DriveRowsAfterRollback = @(Get-DriveOSTursoTessieAuditRows -Repository $Repository -Resource drives -FromEpoch $Started -ToEpoch $Now.ToUnixTimeSeconds() -VehicleId $Snapshot.vehicle.id)
Assert-Rehearsal ($DriveRowsAfterRollback.Count -eq 1) 'Rollback rehearsal changed durable drive data.'

[PSCustomObject]@{
    ok = $true
    isolatedDatabaseConfirmed = $true
    migrationVersions = @($Versions | ForEach-Object { [int]$_.version })
    householdId = $HouseholdId
    ingestion = [PSCustomObject]@{ drives=$DriveRows.Count; charges=$ChargeRows.Count }
    retryIdempotent = $true
    correctionUpserts = $true
    parityReady = $Readiness.ready
    rollbackPreservedRows = $true
} | ConvertTo-Json -Depth 6
