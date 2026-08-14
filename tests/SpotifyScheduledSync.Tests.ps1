$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$WorkflowPath = Join-Path $Root '.github\workflows\spotify-history-sync.yml'
$Workflow = Get-Content $WorkflowPath -Raw
$Render = Get-Content (Join-Path $Root 'render.yaml') -Raw

Assert-True (Test-Path $WorkflowPath) 'Scheduled Spotify workflow is missing.'
Assert-True ($Workflow -match 'cron:\s*"\*/15 \* \* \* \*"') 'Spotify workflow must run every 15 minutes.'
Assert-True ($Workflow -match 'workflow_dispatch:') 'Spotify workflow must support manual runs.'
Assert-True ($Workflow -match 'secrets\.DRIVEOS_SYNC_URL') 'Spotify workflow URL must come from a GitHub secret.'
Assert-True ($Workflow -match 'secrets\.DRIVEOS_SYNC_TOKEN') 'Spotify workflow token must come from a GitHub secret.'
Assert-True ($Workflow -match 'X-DriveOS-Sync-Token') 'Spotify workflow must authenticate its request.'
Assert-True ($Workflow -match 'Content-Type: application/json') 'Spotify workflow must identify its POST body as JSON.'
Assert-True ($Workflow -match "--data '\{\}'") 'Spotify workflow must send a valid JSON body.'
Assert-True ($Server -match 'Test-DriveOSScheduledSyncRequest') 'Scheduled sync endpoint authentication is missing.'
Assert-True ($Server -match 'Invoke-ScheduledSpotifySync') 'Hosted Spotify sync operation is missing.'
$Tokens = $null
$ParseErrors = $null
$Ast = [System.Management.Automation.Language.Parser]::ParseInput($Server,[ref]$Tokens,[ref]$ParseErrors)
Assert-True ($ParseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'
$ScheduledFunction = $Ast.Find({
    param($Node)
    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Invoke-ScheduledSpotifySync'
},$true).Extent.Text
$SummaryFunction = $Ast.Find({
    param($Node)
    $Node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-SpotifySummary'
},$true).Extent.Text
Assert-True ($ScheduledFunction -match 'Get-SpotifyRecent -Limit 50') 'Scheduled sync must collect Spotify recent history.'
Assert-True ($ScheduledFunction -match 'Save-SpotifyHistory -Items') 'Scheduled sync must archive through the existing dedupe path.'
Assert-True ($SummaryFunction -notmatch 'Get-SpotifyRecent|Save-SpotifyHistory|Add-DriveOSListeningHistoryRecord') 'Dashboard Spotify reads can still poll or write through the web request process.'
Assert-True ($Render -match 'DRIVEOS_SPOTIFY_SYNC_SECRET[\s\S]{0,60}sync:\s*false') 'Render sync secret must remain private.'

Write-Host 'DriveOS scheduled Spotify sync checks passed.' -ForegroundColor Green
