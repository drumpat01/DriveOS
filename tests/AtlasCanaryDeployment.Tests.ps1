$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

$Docker = Get-Content (Join-Path $Root 'Dockerfile') -Raw
$Start = Get-Content (Join-Path $Root 'render-start.sh') -Raw
$Blueprint = Get-Content (Join-Path $Root 'render-atlas-canary.yaml') -Raw
$Initializer = Get-Content (Join-Path $Root 'tools\Initialize-AtlasNodeCanary.ps1') -Raw
Assert-True ($Docker -match 'FROM node:24-') 'Atlas canary must build and run on Node 24.'
Assert-True ($Docker -match 'npm run build:server') 'The production image must compile the Node service.'
Assert-True ($Start -match 'DRIVEOS_ATLAS_NODE_CANARY') 'The container lacks an explicit canary entrypoint.'
Assert-True ($Start -match 'server/dist/index\.js') 'The canary entrypoint does not start compiled Atlas.'
Assert-True ($Blueprint -match 'healthCheckPath:\s*/readyz') 'The canary must gate health on Atlas readiness.'
Assert-True ($Blueprint -match 'mountPath:\s*/var/data/atlas') 'The canary lacks durable snapshot storage.'
Assert-True ($Blueprint -match 'branch:\s*codex/atlas-node-hybrid') 'The canary must not deploy from main before promotion.'
Assert-True ($Initializer -match 'TURSO_DATABASE_URL' -and $Initializer -match 'TURSO_AUTH_TOKEN') 'Canary initialization must use the durable source.'
Assert-True ($Initializer -match 'private-import-' -and $Initializer -match 'Remove-Item -LiteralPath \$PrivateSnapshot') 'Private bootstrap material must be deleted.'
Write-Host 'JourneyDeck Atlas canary deployment checks passed.' -ForegroundColor Green
