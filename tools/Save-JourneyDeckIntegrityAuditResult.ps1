param(
    [string]$ReportPath,
    [ValidateSet('audit_failed','report_missing')][string]$FailureReason,
    [string]$HouseholdId = 'household_primary'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ReportPath) -eq [string]::IsNullOrWhiteSpace($FailureReason)) {
    throw 'Provide exactly one of ReportPath or FailureReason.'
}

Import-Module (Join-Path $Root 'src\Configuration\DriveOS.Configuration.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force

$Runtime = Get-DriveOSRuntimeConfiguration -AppRoot $Root
$Repository = New-DriveOSRepository -DataDirectory $Runtime.DataDirectory -AppRoot $Root
if ($Repository.Provider -notin @('SQLite','Turso')) { throw 'Durable integrity audit results require SQLite or Turso.' }

$CompletedAt = [DateTimeOffset]::UtcNow
if ($ReportPath) {
    if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) { throw 'The parity report was not produced.' }
    $Source = Get-Content -LiteralPath $ReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $SafeReport = [ordered]@{
        schemaVersion = 1
        status = "$($Source.status)"
        readyForReadCanary = [bool]$Source.readyForReadCanary
        generatedAtUtc = "$($Source.generatedAtUtc)"
        repositoryProvider = "$($Source.repositoryProvider)"
        auditRange = $Source.auditRange
        maximumCursorLagMinutes = $Source.maximumCursorLagMinutes
        cursors = @($Source.cursors | ForEach-Object { [ordered]@{ resource=$_.resource; passed=[bool]$_.passed; lagMinutes=$_.lagMinutes; lastSuccessAtUtc=$_.lastSuccessAtUtc; hasError=(-not [string]::IsNullOrWhiteSpace("$($_.lastError)")) } })
        resources = [ordered]@{
            drives = [ordered]@{ passed=[bool]$Source.resources.drives.passed; providerCount=$Source.resources.drives.providerCount; databaseCount=$Source.resources.drives.databaseCount; missingFromDatabaseCount=$Source.resources.drives.missingFromDatabaseCount; unexpectedInDatabaseCount=$Source.resources.drives.unexpectedInDatabaseCount; normalizedMismatchCount=$Source.resources.drives.normalizedMismatchCount; compatibilityProjectionMismatchCount=$Source.resources.drives.compatibilityProjectionMismatchCount; payloadMismatchCount=$Source.resources.drives.payloadMismatchCount }
            charges = [ordered]@{ passed=[bool]$Source.resources.charges.passed; providerCount=$Source.resources.charges.providerCount; databaseCount=$Source.resources.charges.databaseCount; missingFromDatabaseCount=$Source.resources.charges.missingFromDatabaseCount; unexpectedInDatabaseCount=$Source.resources.charges.unexpectedInDatabaseCount; normalizedMismatchCount=$Source.resources.charges.normalizedMismatchCount; compatibilityProjectionMismatchCount=$Source.resources.charges.compatibilityProjectionMismatchCount; payloadMismatchCount=$Source.resources.charges.payloadMismatchCount }
        }
        failureReason = $null
    }
}
else {
    $SafeReport = [ordered]@{ schemaVersion=1; status='failed'; readyForReadCanary=$false; generatedAtUtc=$CompletedAt.ToString('o'); repositoryProvider=$Repository.Provider; auditRange=$null; maximumCursorLagMinutes=45; cursors=@(); resources=$null; failureReason=$FailureReason }
}

$GeneratedAt = [DateTimeOffset]::Parse("$($SafeReport.generatedAtUtc)").ToUniversalTime()
$Run = [ordered]@{
    id = New-DriveOSStableDataId -Entity 'integrity_audit' -ProviderKey "$HouseholdId`:tessie-parity`:$($GeneratedAt.ToString('o'))"
    householdId = $HouseholdId
    auditKind = 'tessie-parity'
    status = "$($SafeReport.status)"
    readyForReadCanary = [bool]$SafeReport.readyForReadCanary
    rangeFromUtc = if ($SafeReport.auditRange) { "$($SafeReport.auditRange.fromUtc)" } else { $null }
    rangeToUtc = if ($SafeReport.auditRange) { "$($SafeReport.auditRange.toUtc)" } else { $null }
    generatedAtUtc = $GeneratedAt.ToString('o')
    completedAtUtc = $CompletedAt.ToString('o')
    report = $SafeReport
}
Set-DriveOSIntegrityAuditRun -Repository $Repository -Run $Run
[PSCustomObject]@{ persisted=$true; id=$Run.id; status=$Run.status; readyForReadCanary=$Run.readyForReadCanary }
