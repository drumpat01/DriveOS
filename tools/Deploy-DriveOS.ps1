param(
    [string]$CommitMessage,
    [string[]]$Paths,
    [switch]$SkipTests,
    [switch]$NoPush,
    [switch]$PreflightOnly,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$RulesPath = Join-Path $Root 'deploy-files.json'

function Invoke-DeployGit {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & git -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($Arguments -join ' ')" }
}

function Test-DeployPattern {
    param([string]$Path, [string]$Pattern)
    return $Path.Replace('\', '/') -like $Pattern.Replace('**', '*')
}

function Test-ApprovedDeployPath {
    param([string]$Path, $Rules)
    $Normalized = $Path.Replace('\', '/')
    $Allowed = @($Rules.allowed | Where-Object { Test-DeployPattern $Normalized $_ }).Count -gt 0
    $Forbidden = @($Rules.forbidden | Where-Object { Test-DeployPattern $Normalized $_ }).Count -gt 0
    $PrivateEnvironmentFile = (
        $Normalized -match '(^|/)\.env(?:\..+)?$' -and
        $Normalized -notmatch '(^|/)\.env\.example$'
    )
    return $Allowed -and -not $Forbidden -and -not $PrivateEnvironmentFile
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }
if (-not (Test-Path $RulesPath -PathType Leaf)) { throw 'deploy-files.json is missing.' }

if ($PreflightOnly) {
    & (Join-Path $PSScriptRoot 'Test-ReleasePreflight.ps1') -SkipTests:$SkipTests
    return
}
if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
    throw 'CommitMessage is required unless PreflightOnly is used.'
}

$Branch = (& git -C $Root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Unable to determine the current Git branch.' }

if ($Branch -eq 'main') {
    $StagedBeforeStart = @(& git -C $Root diff --cached --name-only)
    if ($StagedBeforeStart.Count -gt 0) {
        throw 'The Git index already contains staged changes. Commit or unstage them before deploying.'
    }

    Write-Host 'Updating local main...' -ForegroundColor Cyan
    Invoke-DeployGit pull --ff-only origin main
    $DeployBranch = 'deploy/{0}' -f (Get-Date).ToString('yyyyMMdd-HHmmss')
    Invoke-DeployGit switch -c $DeployBranch
}
elseif ($Branch -like 'deploy/*') {
    $DeployBranch = $Branch
    Write-Host "Resuming deployment branch $DeployBranch..." -ForegroundColor Cyan
}
else {
    throw "Deployments must start from main or resume a deploy/* branch. Current branch: $Branch"
}

# Validate after main is updated so the exact code entering the deployment
# branch, including anything just pulled from origin, passes the release gate.
& (Join-Path $PSScriptRoot 'Test-ReleasePreflight.ps1') -SkipTests:$SkipTests

$Changed = @(& git -C $Root diff --name-only)
$Changed += @(& git -C $Root diff --cached --name-only)
$Changed += @(& git -C $Root ls-files --others --exclude-standard)
$Changed = @($Changed | Where-Object { $_ } | Sort-Object -Unique)
$Selected = if ($Paths) { @($Paths | ForEach-Object { $_.Replace('\', '/') } | Sort-Object -Unique) } else { $Changed }
if ($Selected.Count -eq 0) { throw 'No deployment changes were found.' }

$NotChanged = @($Selected | Where-Object { $Changed -notcontains $_ })
if ($NotChanged.Count -gt 0) { throw "Requested paths do not contain changes: $($NotChanged -join ', ')" }

$Rules = Get-Content $RulesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$Rejected = @($Selected | Where-Object { -not (Test-ApprovedDeployPath $_ $Rules) })
if ($Rejected.Count -gt 0) { throw "Deployment blocked forbidden or unexpected files: $($Rejected -join ', ')" }

Write-Host ''
Write-Host 'Approved deployment files:' -ForegroundColor Cyan
$Selected | ForEach-Object { Write-Host "  $_" }
$GitAddArguments = @('add', '--') + @($Selected)
Invoke-DeployGit @GitAddArguments

Write-Host ''
Write-Host 'Exact staged change summary:' -ForegroundColor Cyan
Invoke-DeployGit diff --cached --stat
Invoke-DeployGit diff --cached --name-status

if (-not $Yes) {
    $Answer = Read-Host 'Commit and push exactly these changes? [y/N]'
    if ($Answer -notmatch '^(?i)y(?:es)?$') {
        throw 'Deployment cancelled. Changes remain staged on the deploy branch for review.'
    }
}

Invoke-DeployGit commit -m $CommitMessage
if (-not $NoPush) { Invoke-DeployGit push -u origin $DeployBranch }

$RepositoryUrl = ((& git -C $Root remote get-url origin).Trim() -replace '\.git$', '')
if ($RepositoryUrl -match '^git@github\.com:(.+)$') { $RepositoryUrl = "https://github.com/$($Matches[1])" }

Write-Host ''
Write-Host "Deployment branch: $DeployBranch" -ForegroundColor Green
if ($NoPush) {
    Write-Host "Push when ready: git push -u origin $DeployBranch" -ForegroundColor Yellow
} else {
    Write-Host 'Open this pull request:' -ForegroundColor Green
    Write-Host "$RepositoryUrl/compare/main...$DeployBranch`?expand=1"
}
Write-Host 'Base branch: main'
Write-Host 'Render deploys only after the pull request is merged into main.'
