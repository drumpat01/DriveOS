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

Assert-True (Test-Path (Join-Path $Root "src\Storage\DriveOS.Turso.psm1")) "Turso storage module is missing."
Assert-True ($Repository -match "Turso") "Repository abstraction must support Turso."
Assert-True ($Server -match "Initialize-DriveOSTurso") "Server must initialize Turso."
Assert-True ($Server -match '"spotify-token"') "Spotify tokens must use persistent hosted state."
Assert-True ($Server -match '"spotify-oauth-state"') "Spotify OAuth state must use persistent hosted state."
Assert-True ($Render -match 'plan:\s*starter') "Render service must use the paid Starter instance."
Assert-True ($Render -match 'region:\s*ohio') "Render service should use Ohio."
Assert-True (-not ($Render -match '(?m)^\s*disk:')) "Render service must not attach a disk because Turso is durable storage."
Assert-True ($Render -match 'DRIVEOS_REPOSITORY_PROVIDER[\s\S]{0,60}value:\s*Turso') "Render must use Turso."
Assert-True ($Render -match 'TURSO_AUTH_TOKEN[\s\S]{0,60}sync:\s*false') "Turso token must stay private."
Assert-True ($Render -match 'libsql://driveos-drumpat01\.aws-us-east-2\.turso\.io') "Expected Turso URL is missing."
Assert-True ($Docker -match 'DRIVEOS_REPOSITORY_PROVIDER=Turso') "Docker must default to Turso."
Assert-True (-not ($Docker -match 'sqlite3')) "Hosted container should not install SQLite."

Write-Host "DriveOS Starter web deployment checks passed." -ForegroundColor Green
