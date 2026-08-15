$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$Tool = Get-Content (Join-Path $Root 'tools\Test-JourneyDeckTursoRestore.ps1') -Raw
$Workflow = Get-Content (Join-Path $Root '.github\workflows\turso-restore-rehearsal.yml') -Raw
Assert-True ($Tool -match 'ConfirmProductionReadOnly') 'Restore rehearsal lacks explicit production read-only confirmation.'
Assert-True ($Tool -match 'seed=\[ordered\]@\{ type=''database''; name=\$SourceDatabase') 'Restore rehearsal does not create a database fork from the source.'
Assert-True ($Tool -match 'PRAGMA integrity_check') 'Restore rehearsal does not run SQLite integrity_check.'
Assert-True ($Tool -match 'schema_migrations') 'Restore rehearsal does not verify ordered migrations.'
Assert-True ($Tool -match 'SourceCounts\[\$Table\] -ne \$RestoreCounts\[\$Table\]') 'Restore rehearsal does not compare source and restored row counts.'
Assert-True ($Tool -match 'SourceCountsBefore\[\$Table\] -ne \$SourceCounts\[\$Table\]') 'Restore rehearsal does not detect concurrent source writes.'
Assert-True ($Tool -match 'finally\s*\{' -and $Tool -match 'Method Delete') 'Restore rehearsal does not guarantee disposable cleanup.'
Assert-True ($Tool -match 'StatusCode -eq 404') 'Restore rehearsal does not independently confirm deletion.'
Assert-True ($Workflow -match '(?m)^\s*schedule:\s*$' -and $Workflow -match 'cron:\s*"43 7 \* \* 0"') 'Restore rehearsal is not scheduled weekly.'
Assert-True ($Workflow -match 'TURSO_PLATFORM_TOKEN:\s*\$\{\{ secrets\.TURSO_PLATFORM_TOKEN \}\}') 'Restore workflow is missing its Turso platform token secret.'
Assert-True ($Workflow -match 'TURSO_ORGANIZATION:\s*\$\{\{ vars\.TURSO_ORGANIZATION \}\}') 'Restore workflow is missing its organization variable.'
Assert-True ($Workflow -notmatch '(?im)(Write-(Host|Output)|Add-Content)[^\r\n]*(TURSO_|DATABASE_URL|AUTH_TOKEN|PLATFORM_TOKEN)') 'Restore workflow risks printing credentials.'

$Rejected = $false
try { & (Join-Path $Root 'tools\Test-JourneyDeckTursoRestore.ps1') -Organization test-org -SourceDatabase test-db -Group default -PlatformToken test -SourceDatabaseUrl libsql://test.turso.io -SourceAuthToken test }
catch { $Rejected = $_.Exception.Message -match 'ConfirmProductionReadOnly' }
Assert-True $Rejected 'Restore rehearsal must refuse to run without explicit production read-only confirmation.'
Write-Host 'JourneyDeck Turso restore workflow checks passed.' -ForegroundColor Green
