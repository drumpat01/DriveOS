$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$Workflow = Get-Content (Join-Path $Root '.github\workflows\tessie-readiness-audit.yml') -Raw
$Publisher = Get-Content (Join-Path $Root 'tools\Save-JourneyDeckIntegrityAuditResult.ps1') -Raw

Assert-True ($Workflow -match '(?m)^\s*workflow_dispatch:\s*$') 'The production readiness audit must support an explicit manual run.'
Assert-True ($Workflow -match '(?m)^\s*schedule:\s*$' -and $Workflow -match 'cron:\s*"23 6 \* \* \*"') 'The durable parity audit must run daily outside request paths.'
Assert-True ($Workflow -match "if:\s*vars\.JOURNEYDECK_TESSIE_DB_WRITE_ENABLED == 'true'") 'The readiness audit is not coupled to the active durable writer.'
Assert-True ($Workflow -match 'DRIVEOS_REPOSITORY_PROVIDER:\s*Turso') 'The readiness audit does not force the production Turso provider.'
Assert-True ($Workflow -match 'TURSO_DATABASE_URL:\s*\$\{\{ secrets\.TURSO_DATABASE_URL \}\}') 'The readiness audit is missing its Turso URL secret.'
Assert-True ($Workflow -match 'TURSO_AUTH_TOKEN:\s*\$\{\{ secrets\.TURSO_AUTH_TOKEN \}\}') 'The readiness audit is missing its Turso token secret.'
Assert-True ($Workflow -match 'TESSIE_TOKEN:\s*\$\{\{ secrets\.TESSIE_TOKEN \}\}') 'The readiness audit is missing its Tessie token secret.'
Assert-True ($Workflow -match 'Test-JourneyDeckTessieParity\.ps1[\s\S]{0,240}-Days 30[\s\S]{0,240}-MaximumCursorLagMinutes 90') 'The readiness audit does not enforce the approved 30-day parity and cursor gate.'
Assert-True ($Workflow -match 'Save-JourneyDeckIntegrityAuditResult\.ps1') 'The scheduled audit does not durably publish its privacy-safe result.'
Assert-True ($Workflow -match 'Enforce readiness result') 'The scheduled audit does not fail when the durable read gate fails.'
Assert-True ($Workflow -match 'RUNNER_TEMP') 'The readiness report must be written outside the repository checkout.'
Assert-True ($Workflow -match 'Test-JourneyDeckTessieParity\.ps1[\s\S]{0,300}\| Out-Null') 'Detailed parity report objects must not be emitted to the Actions log.'
Assert-True ($Workflow -match 'actions/checkout@v7') 'The readiness audit checkout action must use the Node 24 runtime.'
Assert-True ($Workflow -match 'actions/upload-artifact@v7') 'The privacy-safe parity report is not archived with the Node 24 action runtime.'
Assert-True ($Workflow -match 'retention-days:\s*14') 'The parity artifact retention period changed unexpectedly.'
Assert-True ($Workflow -match 'Raw payload drift \(diagnostic only\)') 'The readiness summary does not disclose advisory raw payload drift.'
Assert-True ($Workflow -notmatch 'Sync-JourneyDeckTessieHistory|Initialize-DriveOS(Sqlite|Turso)') 'The readiness workflow must not ingest provider history or apply migrations.'
Assert-True ($Workflow -notmatch '(?im)(Write-(Host|Output)|Add-Content)[^\r\n]*(TURSO_|TESSIE_TOKEN|raw_payload|examples)') 'The readiness workflow risks printing secrets or detailed provider records.'
Assert-True ($Publisher -match 'SafeReport' -and $Publisher -notmatch '\.examples|\.vehicleId|raw_payload') 'The durable audit publisher must retain only privacy-safe aggregate evidence.'
Assert-True ($Publisher -match "FailureReason = 'audit_failed'|'audit_failed','report_missing'") 'The durable audit publisher does not support a redacted failure result.'

Write-Host 'JourneyDeck Tessie audit workflow checks passed.' -ForegroundColor Green
