$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$WorkflowPath = Join-Path $Root '.github\workflows\spotify-history-sync.yml'
$Workflow = Get-Content $WorkflowPath -Raw
$Render = Get-Content (Join-Path $Root 'render.yaml') -Raw

Assert-True (Test-Path $WorkflowPath) 'Scheduled Spotify workflow is missing.'
Assert-True ($Workflow -match 'cron:\s*"17 \*/2 \* \* \*"') 'Spotify workflow must run every two hours off the top of the hour.'
Assert-True ($Workflow -match 'workflow_dispatch:') 'Spotify workflow must support manual runs.'
Assert-True ($Workflow -match 'secrets\.DRIVEOS_SYNC_URL') 'Spotify workflow URL must come from a GitHub secret.'
Assert-True ($Workflow -match 'secrets\.DRIVEOS_SYNC_TOKEN') 'Spotify workflow token must come from a GitHub secret.'
Assert-True ($Workflow -match 'X-DriveOS-Sync-Token') 'Spotify workflow must authenticate its request.'
Assert-True ($Server -match 'Test-DriveOSScheduledSyncRequest') 'Scheduled sync endpoint authentication is missing.'
Assert-True ($Server -match 'Invoke-ScheduledSpotifySync') 'Hosted Spotify sync operation is missing.'
Assert-True ($Server -match 'Get-SpotifyRecent -Limit 50') 'Scheduled sync must collect Spotify recent history.'
Assert-True ($Server -match 'Save-SpotifyHistory -Items') 'Scheduled sync must archive through the existing dedupe path.'
Assert-True ($Render -match 'DRIVEOS_SPOTIFY_SYNC_SECRET[\s\S]{0,60}sync:\s*false') 'Render sync secret must remain private.'

Write-Host 'DriveOS scheduled Spotify sync checks passed.' -ForegroundColor Green
