$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$ToolPath = Join-Path $Root 'tools\Test-JourneyDeckTursoRehearsal.ps1'
$Tool = Get-Content -LiteralPath $ToolPath -Raw
Assert-True ($Tool -match 'ConfirmIsolatedDatabase') 'Real Turso rehearsal lacks an explicit isolation confirmation.'
Assert-True ($Tool -match 'Initialize-DriveOSTurso') 'Real Turso rehearsal does not exercise ordered migrations.'
Assert-True ($Tool -match 'Save-DriveOSTessieHistorySnapshot') 'Real Turso rehearsal does not exercise ingestion and retries.'
Assert-True ($Tool -match 'synthetic rehearsal failure') 'Real Turso rehearsal does not exercise failed-run cursor behavior.'
Assert-True ($Tool -match 'Assert-JourneyDeckTessieReadReady') 'Real Turso rehearsal does not exercise read-canary readiness.'
Assert-True ($Tool -match 'rollbackPreservedRows') 'Real Turso rehearsal does not report nondestructive rollback verification.'

$RejectedWithoutConfirmation = $false
try { & $ToolPath -DatabaseUrl 'libsql://isolated-example.turso.io' -AuthToken 'test-token' }
catch { $RejectedWithoutConfirmation = $_.Exception.Message -match 'ConfirmIsolatedDatabase' }
Assert-True $RejectedWithoutConfirmation 'Real Turso rehearsal must refuse to write without isolation confirmation.'

Write-Host 'JourneyDeck real-Turso rehearsal harness checks passed.' -ForegroundColor Green
