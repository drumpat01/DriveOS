$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$TursoModulePath = Join-Path $Root "src\Storage\DriveOS.Turso.psm1"
$RepositoryModulePath = Join-Path $Root "src\Repositories\DriveOS.Repository.psm1"

function Assert-True {
    param([bool]$Condition,[string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

Import-Module $TursoModulePath -Force
Import-Module $RepositoryModulePath -Force

$HttpUrl = Get-DriveOSTursoHttpUrl `
    -DatabaseUrl "libsql://driveos-example.turso.io"

Assert-True `
    ($HttpUrl -eq "https://driveos-example.turso.io") `
    "Turso libsql URL should convert to HTTPS."

$BadUrlRejected = $false

try {
    $null = Get-DriveOSTursoHttpUrl -DatabaseUrl "https://evil.example.com"
}
catch {
    $BadUrlRejected = $true
}

Assert-True $BadUrlRejected "Unexpected Turso URL formats must be rejected."

$OldProvider = $env:DRIVEOS_REPOSITORY_PROVIDER
$OldUrl = $env:TURSO_DATABASE_URL
$OldToken = $env:TURSO_AUTH_TOKEN

try {
    $env:DRIVEOS_REPOSITORY_PROVIDER = "Turso"
    $env:TURSO_DATABASE_URL = "libsql://driveos-example.turso.io"
    $env:TURSO_AUTH_TOKEN = "test-token"

    $Repository = New-DriveOSRepository `
        -DataDirectory (Join-Path $env:TEMP "driveos-turso-test")

    Assert-True ($Repository.Provider -eq "Turso") "Repository provider should support Turso."
    Assert-True ($Repository.TursoDatabaseUrl -eq $env:TURSO_DATABASE_URL) "Turso database URL should be retained."
    Assert-True ($Repository.TursoAuthToken -eq "test-token") "Turso auth token should load from environment."
}
finally {
    $env:DRIVEOS_REPOSITORY_PROVIDER = $OldProvider
    $env:TURSO_DATABASE_URL = $OldUrl
    $env:TURSO_AUTH_TOKEN = $OldToken
}

$Source = Get-Content $TursoModulePath -Raw
$MigrationSql = @(Get-ChildItem (Join-Path $Root 'src\Storage\Migrations') -Filter '*.sql' -File | Sort-Object Name | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"

Assert-True ($Source -match '/v2/pipeline') "Turso storage must use SQL-over-HTTP."
Assert-True ($Source -match 'Authorization\s*=\s*"Bearer') "Turso requests must use Bearer auth."
Assert-True ($Source -match 'schema_migrations') "Turso must apply ordered schema migrations."
Assert-True ($Source -match "type = 'batch'") "Turso transactional writes must use Hrana batches."
Assert-True ($Source -match 'type = ''ok''; step = \$PreviousStep') "Turso batch steps must stop after the first failed statement."
Assert-True ($Source -match "sql = 'ROLLBACK;'") "Turso transactional batches must roll back failed writes."
Assert-True ($Source -match '-TimeoutSec \(Get-DriveOSTursoHttpTimeoutSeconds\)') 'Turso HTTP requests must use an explicit bounded timeout.'
Assert-True ($Source -match 'Invoke-DriveOSTursoStatementChunks') 'Turso Tessie writes must use bounded statement chunks.'
Assert-True ($Source -match 'legacy_drive_id=excluded\.legacy_drive_id') 'Turso correction upserts must update the legacy drive ID.'
Assert-True ($Source -match 'started_at_epoch=excluded\.started_at_epoch' -and $Source -match 'ended_at_epoch=excluded\.ended_at_epoch') 'Turso correction upserts must update epoch columns.'
Assert-True ($MigrationSql -match 'CREATE TABLE IF NOT EXISTS app_state') "Shared migrations must persist app state."
Assert-True ($MigrationSql -match 'CREATE TABLE IF NOT EXISTS drive_soundtracks') "Shared migrations must persist one canonical soundtrack record per drive."
Assert-True ($Source -match 'ON CONFLICT\(drive_id\) DO UPDATE') "Turso soundtrack writes must upsert by drive ID."
Assert-True ($Source -match 'function Get-DriveOSTursoTessieAuditRows') 'Turso is missing bounded parity audit queries.'
Assert-True ($Source -match 'started_at_epoch >= \? AND started_at_epoch <= \?') 'Turso parity audit query is not bounded at both high-watermarks.'

$global:DriveOSTestTursoBody = $null
$global:DriveOSTestTursoBodies = New-Object System.Collections.ArrayList
$global:DriveOSTestTursoTimeouts = New-Object System.Collections.ArrayList
function global:Invoke-RestMethod {
    param($Uri,$Method,$Headers,$ContentType,$Body,$TimeoutSec)
    $global:DriveOSTestTursoBody = $Body
    $null = $global:DriveOSTestTursoBodies.Add($Body)
    $null = $global:DriveOSTestTursoTimeouts.Add($TimeoutSec)
    $Request = $Body | ConvertFrom-Json
    $StepCount = @($Request.requests[0].batch.steps).Count
    $StepResults = New-Object object[] $StepCount
    $StepErrors = New-Object object[] $StepCount
    for ($Index = 0; $Index -lt ($StepCount - 1); $Index++) { $StepResults[$Index] = [PSCustomObject]@{} }
    return [PSCustomObject]@{
        results = @([PSCustomObject]@{
            type = 'ok'
            response = [PSCustomObject]@{
                type = 'batch'
                result = [PSCustomObject]@{ step_results=$StepResults; step_errors=$StepErrors }
            }
        })
    }
}
try {
    $FakeRepository = [PSCustomObject]@{ TursoDatabaseUrl='libsql://driveos-example.turso.io'; TursoAuthToken='test-token' }
    Invoke-DriveOSTursoTransactionalBatch -Repository $FakeRepository -Statements @(
        [PSCustomObject]@{ Sql='INSERT INTO example(a) VALUES(?);'; Args=@('one') },
        [PSCustomObject]@{ Sql='INSERT INTO example(a) VALUES(?);'; Args=@('two') }
    )
    $BatchPayload = $global:DriveOSTestTursoBody | ConvertFrom-Json
    $Steps = @($BatchPayload.requests[0].batch.steps)
    Assert-True ($BatchPayload.requests[0].type -eq 'batch') 'Turso transaction did not emit a Hrana batch request.'
    Assert-True ($Steps[1].condition.type -eq 'ok' -and [int]$Steps[1].condition.step -eq 0) 'First write is not conditional on BEGIN.'
    Assert-True ($Steps[2].condition.type -eq 'ok' -and [int]$Steps[2].condition.step -eq 1) 'Second write is not conditional on the prior write.'
    Assert-True ($Steps[-2].stmt.sql -eq 'COMMIT;') 'Conditional COMMIT is missing.'
    Assert-True ($Steps[-1].stmt.sql -eq 'ROLLBACK;') 'Conditional ROLLBACK is missing.'
    Assert-True ($global:DriveOSTestTursoTimeouts[-1] -eq 30) 'Turso transactional requests did not apply the default timeout.'

    $ChunkStart = $global:DriveOSTestTursoBodies.Count
    Invoke-DriveOSTursoStatementChunks -Repository $FakeRepository -MaximumStatements 2 -Statements @(
        1..5 | ForEach-Object { [PSCustomObject]@{ Sql='INSERT INTO example(a) VALUES(?);'; Args=@("value-$_") } }
    )
    $ChunkBodies = @($global:DriveOSTestTursoBodies[$ChunkStart..($global:DriveOSTestTursoBodies.Count - 1)])
    Assert-True ($ChunkBodies.Count -eq 3) 'Five statements with a two-statement bound must produce three transactions.'
    foreach ($ChunkBody in $ChunkBodies) {
        $ChunkSteps = @(($ChunkBody | ConvertFrom-Json).requests[0].batch.steps)
        Assert-True (($ChunkSteps.Count - 3) -le 2) 'A Turso transaction exceeded the configured statement bound.'
    }

    $Run = New-DriveOSIntegrationSyncRun -Provider tessie -Resource charges -RangeFromUtc ([DateTimeOffset]::Parse('2026-08-01T00:00:00Z')) -RangeToUtc ([DateTimeOffset]::Parse('2026-08-14T00:00:00Z'))
    $Run.status = 'failed'
    $Run.errorMessage = 'provider timeout'
    Set-DriveOSTursoIntegrationSyncRun -Repository $FakeRepository -Run $Run
    $RunPayload = $global:DriveOSTestTursoBody | ConvertFrom-Json
    $RunSteps = @($RunPayload.requests[0].batch.steps)
    Assert-True ($RunSteps[2].stmt.sql -match 'integration_sync_runs') 'Turso sync-run state is not written transactionally.'
    Assert-True ($RunSteps[3].stmt.sql -match 'integration_sync_cursors') 'Turso cursor attempt/error state is not written with the sync run.'
    Assert-True ($RunSteps[-2].stmt.sql -eq 'COMMIT;') 'Turso sync-run state is missing its transactional COMMIT.'
}
finally {
    Remove-Item Function:\global:Invoke-RestMethod -ErrorAction SilentlyContinue
    Remove-Variable DriveOSTestTursoBody -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable DriveOSTestTursoBodies -Scope Global -ErrorAction SilentlyContinue
    Remove-Variable DriveOSTestTursoTimeouts -Scope Global -ErrorAction SilentlyContinue
}

Write-Host "DriveOS Turso checks passed." -ForegroundColor Green
