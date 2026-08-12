$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$Deploy = Get-Content (Join-Path $Root 'tools\Deploy-DriveOS.ps1') -Raw
$Preflight = Get-Content (Join-Path $Root 'tools\Test-ReleasePreflight.ps1') -Raw
$Rules = Get-Content (Join-Path $Root 'deploy-files.json') -Raw | ConvertFrom-Json

$Tokens = $null
$ParseErrors = $null
$DeployAst = [Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $Root 'tools\Deploy-DriveOS.ps1'),
    [ref]$Tokens,
    [ref]$ParseErrors
)
Assert-True ($ParseErrors.Count -eq 0) 'Deploy workflow must parse cleanly.'
foreach ($FunctionName in @('Test-DeployPattern', 'Test-ApprovedDeployPath')) {
    $FunctionAst = $DeployAst.FindAll({
        param($Node)
        $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and
        $Node.Name -eq $FunctionName
    }, $true) | Select-Object -First 1
    Assert-True ($null -ne $FunctionAst) "Missing deploy function: $FunctionName"
    Invoke-Expression $FunctionAst.Extent.Text
}

Assert-True ($Deploy -match "Branch -eq 'main'") 'Workflow must start fresh deployments from main.'
Assert-True ($Deploy -match "Branch -like 'deploy/\*'") 'Workflow must resume interrupted deploy branches.'
Assert-True ($Deploy -match 'pull --ff-only origin main') 'Workflow must fast-forward main.'
Assert-True ($Deploy -match 'diff --cached --name-only') 'Workflow must include staged files when resuming.'
Assert-True ($Deploy -match 'PrivateEnvironmentFile') 'Workflow must distinguish private environment files.'
Assert-True ($Deploy -match '\.env\\\.example') 'Workflow must allow the public environment template.'
Assert-True ($Deploy -match "'deploy/\{0\}'") 'Workflow must create timestamped branches.'
Assert-True ($Deploy -match 'diff --cached --name-status') 'Workflow must show staged files.'
Assert-True ($Deploy -match 'push -u origin \$DeployBranch') 'Workflow must push only its branch.'
Assert-True ($Deploy -match 'compare/main\.\.\.') 'Workflow must print a PR URL.'
Assert-True ($Preflight -match 'Mojibake') 'Preflight must check for mojibake.'
Assert-True (@($Rules.forbidden) -contains '**/*.zip') 'Rules must reject ZIP files.'
Assert-True (@($Rules.forbidden) -contains '**/*secret*.json') 'Rules must reject secret JSON files.'
Assert-True (@($Rules.forbidden) -notcontains '.env.*') 'Rules must not reject .env.example.'
Assert-True (Test-ApprovedDeployPath '.github/workflows/spotify-history-sync.yml' $Rules) 'Approved GitHub workflows must be deployable.'
Assert-True (Test-ApprovedDeployPath '.env.example' $Rules) '.env.example must be deployable.'
Assert-True (-not (Test-ApprovedDeployPath '.env.local' $Rules)) '.env.local must be blocked.'
Assert-True (-not (Test-ApprovedDeployPath 'data/private.json' $Rules)) 'Private data must be blocked.'
Assert-True (Test-ApprovedDeployPath 'web/app.js' $Rules) 'Web source must be deployable.'

Write-Host 'DriveOS release workflow checks passed.' -ForegroundColor Green
