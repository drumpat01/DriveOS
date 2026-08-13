$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

$server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$auth = Get-Content (Join-Path $Root 'src\Security\DriveOS.WebAuth.psm1') -Raw
$wifeHtml = Get-Content (Join-Path $Root 'web\wife.html') -Raw
$wifeJs = Get-Content (Join-Path $Root 'web\wife.js') -Raw

Assert-True ($auth -match 'DRIVEOS_WIFE_USERNAME') 'Wife username configuration is missing.'
Assert-True ($auth -match 'DRIVEOS_WIFE_PASSWORD_HASH') 'Wife password configuration is missing.'
Assert-True ($server -match 'Get-WifeModeSummary') 'Wife summary endpoint is missing.'
Assert-True ($server -match '"/api/wife/mode"') 'Wife Mode switch endpoint is missing.'
Assert-True ($wifeHtml -match 'Open Full JourneyDeck') 'Full JourneyDeck toggle is missing.'
Assert-True ($wifeHtml -notmatch '(?i)charging|notification|sign out') 'Wife screen includes an excluded control.'
Assert-True ($wifeJs -match '/api/wife/summary') 'Wife dashboard does not request its curated summary.'
Assert-True ($wifeJs -match '/api/wife/mode') 'Wife dashboard cannot switch to full mode.'
Write-Host 'Wife Mode checks passed.' -ForegroundColor Green
