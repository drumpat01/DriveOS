$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

$Docker = Get-Content (Join-Path $Root 'Dockerfile') -Raw
$Start = Get-Content (Join-Path $Root 'render-start.sh') -Raw
$Blueprint = Get-Content (Join-Path $Root 'render-atlas-canary.yaml') -Raw
$Refresh = Get-Content (Join-Path $Root 'server\src\refresh-hosted-snapshot.ts') -Raw
$TursoClient = Get-Content (Join-Path $Root 'server\src\turso-client.ts') -Raw
Assert-True ($Docker -match 'FROM node:24-') 'Atlas canary must build and run on Node 24.'
Assert-True ($Docker -match 'npm run build:server') 'The production image must compile the Node service.'
Assert-True ($Start -match 'DRIVEOS_ATLAS_NODE_CANARY') 'The container lacks an explicit canary entrypoint.'
Assert-True ($Start -match 'server/dist/index\.js') 'The canary entrypoint does not start compiled Atlas.'
Assert-True ($Blueprint -match 'healthCheckPath:\s*/readyz') 'The canary must gate health on Atlas readiness.'
Assert-True ($Blueprint -match 'mountPath:\s*/var/data/atlas') 'The canary lacks durable snapshot storage.'
Assert-True ($Blueprint -match 'branch:\s*codex/atlas-node-hybrid') 'The canary must not deploy from main before promotion.'
Assert-True ($Start -match 'node ./server/dist/refresh-hosted-snapshot\.js') 'Hosted Atlas lacks compiled continuous source refresh.'
Assert-True ($Start -match 'compatibility server exited with status' -and $Start -match 'while true') 'The compatibility API process must restart after an unexpected exit.'
Assert-True ($Start -match 'LEGACY_CHILD' -and $Start -match "trap '.*kill") 'The compatibility API supervisor must clean up its child process.'
Assert-True ($TursoClient -match 'TURSO_DATABASE_URL' -and $TursoClient -match 'TURSO_AUTH_TOKEN' -and $TursoClient -match '/v2/pipeline') 'Hosted refresh must use authenticated Turso pipeline queries.'
Assert-True ($Refresh -match 'before !== after' -and $Refresh -match 'drives\.length !== after') 'Hosted refresh lacks source consistency checks.'
Assert-True ($Refresh -match 'BEGIN IMMEDIATE' -and $Refresh -match 'ROLLBACK') 'Hosted refresh must update the local snapshot transactionally.'
Write-Host 'JourneyDeck Atlas canary deployment checks passed.' -ForegroundColor Green
