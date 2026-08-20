$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition,[string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

$Server = Get-Content (Join-Path $Root "DriveOS-Server.ps1") -Raw
$Repository = Get-Content (Join-Path $Root "src\Repositories\DriveOS.Repository.psm1") -Raw
$Render = Get-Content (Join-Path $Root "render.yaml") -Raw
$Docker = Get-Content (Join-Path $Root "Dockerfile") -Raw
$Start = Get-Content (Join-Path $Root "render-start.sh") -Raw

Assert-True (Test-Path (Join-Path $Root "src\Storage\DriveOS.Turso.psm1")) "Turso storage module is missing."
Assert-True ($Repository -match "Turso") "Repository abstraction must support Turso."
Assert-True ($Server -match "Initialize-DriveOSTurso") "Server must initialize Turso."
Assert-True ($Server -match '"spotify-token"') "Spotify tokens must use persistent hosted state."
Assert-True ($Server -match '"spotify-oauth-state"') "Spotify OAuth state must use persistent hosted state."
Assert-True ($Render -match 'plan:\s*standard') "Render service must use the Standard instance with 2 GB of memory."
Assert-True ($Render -match 'region:\s*ohio') "Render service should use Ohio."
Assert-True (-not ($Render -match '(?m)^\s*disk:')) "Render must keep the derived Atlas cache ephemeral so zero-downtime deploys remain available."
Assert-True ($Render -match 'DRIVEOS_NODE_DATABASE[\s\S]{0,80}value:\s*/tmp/driveos/atlas/journeydeck\.db' -and $Render -match 'DRIVEOS_NODE_DATA_ROOT[\s\S]{0,80}value:\s*/tmp/driveos/atlas') "Render must place the derived Atlas cache on the ephemeral filesystem."
Assert-True ($Render -match 'DRIVEOS_ATLAS_DURABLE_TURSO[\s\S]{0,60}value:\s*"true"') "Atlas labels and pattern decisions must remain durable in Turso."
Assert-True ($Render -match 'DRIVEOS_ATLAS_LEGACY_DATABASE[\s\S]{0,80}value:\s*/var/data/atlas/journeydeck\.db') "The first stateless deploy must migrate any existing disk-backed Atlas decisions before disk removal."
Assert-True ($Render -match 'healthCheckPath:\s*/readyz') "Render must wait for Node, Atlas, and the compatibility API before going live."
Assert-True ($Render -match 'autoDeployTrigger:\s*checksPass') "Render must not deploy a commit until required GitHub checks pass."
Assert-True ($Render -match 'maxShutdownDelaySeconds:\s*60') "Render must allow the previous instance to drain in-flight requests."
Assert-True ($Start -match 'server/dist/wait-for-compatibility\.js[\s\S]+server/dist/refresh-hosted-snapshot\.js[\s\S]+server/dist/index\.js') "The production process must gate Node startup on compatibility readiness before refreshing Atlas and listening publicly."
Assert-True ($Start -match 'DRIVEOS_COMPATIBILITY_READY_FILE' -and $Start -match 'rm -f "\$\{COMPATIBILITY_READY_FILE\}"') "The compatibility supervisor must publish and clear independent process readiness state."
Assert-True ($Start -match 'if node \./server/dist/wait-for-compatibility\.js; then[\s\S]+: > "\$\{COMPATIBILITY_READY_FILE\}"[\s\S]+wait "\$\{LEGACY_CHILD\}"') "Every restarted compatibility process must pass its application-level gate before the supervisor republishes readiness."
Assert-True ($Render -match 'DRIVEOS_REPOSITORY_PROVIDER[\s\S]{0,60}value:\s*Turso') "Render must use Turso."
Assert-True ($Render -match 'TURSO_AUTH_TOKEN[\s\S]{0,60}sync:\s*false') "Turso token must stay private."
Assert-True ($Render -match 'libsql://driveos-drumpat01\.aws-us-east-2\.turso\.io') "Expected Turso URL is missing."
Assert-True ($Docker -match 'DRIVEOS_REPOSITORY_PROVIDER=Turso') "Docker must default to Turso."
Assert-True (-not ($Docker -match 'sqlite3')) "Hosted container should not install SQLite."

Write-Host "DriveOS Standard web deployment checks passed." -ForegroundColor Green
