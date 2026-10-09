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
Assert-True ($Render -match 'plan:\s*standard') "Render service must stay on the Standard instance until Free is verified as a second step."
Assert-True ($Render -match 'region:\s*ohio') "Render service should use Ohio."
Assert-True (-not ($Render -match '(?m)^\s*disk:')) "Render must keep the derived Atlas cache ephemeral so zero-downtime deploys remain available."
Assert-True ($Render -match 'DRIVEOS_NODE_DATABASE[\s\S]{0,80}value:\s*/tmp/driveos/atlas/journeydeck\.db' -and $Render -match 'DRIVEOS_NODE_DATA_ROOT[\s\S]{0,80}value:\s*/tmp/driveos/atlas') "Render must place the derived Atlas cache on the ephemeral filesystem."
Assert-True ($Render -match 'DRIVEOS_ATLAS_DURABLE_TURSO[\s\S]{0,60}value:\s*"true"') "Atlas labels and pattern decisions must remain durable in Turso."
Assert-True ($Render -match 'DRIVEOS_ATLAS_LEGACY_DATABASE[\s\S]{0,80}value:\s*/var/data/atlas/journeydeck\.db') "Keep the existing persistent disk path from main so blueprint sync does not delete the disk."
Assert-True ($Render -match 'DRIVEOS_COMPATIBILITY_LAZY[\s\S]{0,60}value:\s*"true"') "PowerShell must start only when a compatibility route needs it."
Assert-True ($Render -match 'DRIVEOS_ATLAS_INLINE_REBUILD[\s\S]{0,60}value:\s*"true"') "Hosted Atlas rebuilds must stay in-process to avoid a second V8 heap."
Assert-True ($Render -match 'healthCheckPath:\s*/readyz') "Render must probe the Node listener. Atlas refresh is in-process after listen."
Assert-True ($Render -match 'autoDeployTrigger:\s*checksPass') "Render must not deploy a commit until required GitHub checks pass."
Assert-True ($Render -match 'maxShutdownDelaySeconds:\s*60') "Render must allow the previous instance to drain in-flight requests."
Assert-True ($Start -match 'DRIVEOS_COMPATIBILITY_LAZY') "The start script must default to lazy PowerShell."
Assert-True ($Start -match 'exec node \./server/dist/index\.js') "The public process must be Node."
Assert-True (-not ($Start -match 'wait-for-compatibility')) "Cold start must not wait for PowerShell before Node listens."
Assert-True (-not ($Start -match 'refresh-hosted-snapshot')) "Atlas refresh must not run as a second Node process before listen."
Assert-True ($Render -match 'DRIVEOS_REPOSITORY_PROVIDER[\s\S]{0,60}value:\s*Turso') "Render must use Turso."
Assert-True ($Render -match 'TURSO_AUTH_TOKEN[\s\S]{0,60}sync:\s*false') "Turso token must stay private."
Assert-True ($Render -match 'libsql://driveos-drumpat01\.aws-us-east-2\.turso\.io') "Expected Turso URL is missing."
Assert-True ($Docker -match 'DRIVEOS_REPOSITORY_PROVIDER=Turso') "Docker must default to Turso."
Assert-True (-not ($Docker -match 'sqlite3')) "Hosted container should not install SQLite."
Assert-True (-not ($Docker -match 'nginx')) "The hosted image no longer needs nginx in front of Node."

Write-Host "DriveOS Standard web deployment checks passed." -ForegroundColor Green
