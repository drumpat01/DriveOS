$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$Deploy = Get-Content (Join-Path $Root 'tools\Deploy-DriveOS.ps1') -Raw
$Preflight = Get-Content (Join-Path $Root 'tools\Test-ReleasePreflight.ps1') -Raw
$Rules = Get-Content (Join-Path $Root 'deploy-files.json') -Raw | ConvertFrom-Json

Assert-True ($Deploy -match "Branch -eq 'main'") 'Workflow must start fresh deployments from main.'
Assert-True ($Deploy -match "Branch -like 'deploy/\*'") 'Workflow must resume interrupted deploy branches.'
Assert-True ($Deploy -match 'pull --ff-only origin main') 'Workflow must fast-forward main.'
Assert-True ($Deploy -match "'deploy/\{0\}'") 'Workflow must create timestamped branches.'
Assert-True ($Deploy -match 'diff --cached --name-status') 'Workflow must show staged files.'
Assert-True ($Deploy -match 'push -u origin \$DeployBranch') 'Workflow must push only its branch.'
Assert-True ($Deploy -match 'compare/main\.\.\.') 'Workflow must print a PR URL.'
Assert-True ($Preflight -match 'Mojibake') 'Preflight must check for mojibake.'
Assert-True (@($Rules.forbidden) -contains '**/*.zip') 'Rules must reject ZIP files.'
Assert-True (@($Rules.forbidden) -contains '**/*secret*.json') 'Rules must reject secret JSON files.'

Write-Host 'DriveOS release workflow checks passed.' -ForegroundColor Green
