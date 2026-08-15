$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force

function Assert-True([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }

$Scratch = Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-health-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Scratch | Out-Null
try {
    $Repository = New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider Json
    $Record = [ordered]@{ provider='spotify'; status='healthy'; lastAttemptAtUtc='2026-08-14T12:00:00Z'; lastSuccessAtUtc='2026-08-14T12:00:02Z'; archiveTotal=42; lastError=$null }
    Set-DriveOSIntegrationHealthRecord -Repository $Repository -Provider spotify -Record $Record
    $RoundTrip = Get-DriveOSIntegrationHealthRecord -Repository $Repository -Provider spotify
    Assert-True ($RoundTrip.status -eq 'healthy' -and $RoundTrip.archiveTotal -eq 42) 'Integration health does not round-trip through the compatibility repository.'
    Assert-True ($null -eq (Get-DriveOSIntegrationHealthRecord -Repository $Repository -Provider tessie)) 'A missing integration health record must remain absent.'
}
finally {
    if (Test-Path -LiteralPath $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
}

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Index = Get-Content (Join-Path $Root 'web\index.html') -Raw
$Wife = Get-Content (Join-Path $Root 'web\wife.html') -Raw
$App = Get-Content (Join-Path $Root 'web\app.js') -Raw
$Feature = Get-Content (Join-Path $Root 'web\features\data-health.js') -Raw

Assert-True ($Server -match '"/api/data-health"') 'Data Health API endpoint is missing.'
Assert-True ($Server -match "Principal\.Role -ne 'owner'") 'Hosted Data Health is not explicitly restricted to the owner role.'
Assert-True ($Server -match 'Get-DriveOSIntegrationSyncCursor.+tessie') 'Data Health does not use durable Tessie cursors.'
Assert-True ($Server -match "Get-DriveOSIntegrationHealthRecord.+spotify") 'Data Health does not use durable Spotify health.'
$HealthFunction = [regex]::Match($Server, '(?s)function Get-DataHealthSummary\s*\{.*?(?=\r?\n\})').Value
Assert-True ($HealthFunction -notmatch 'Get-RawDrives|Get-SpotifyRecent|New-TessieClient') 'Data Health can call an external provider from the web request process.'
Assert-True ($Index -match 'id="dataHealthNav"[^>]*hidden' -and $Index -match 'id="mobileDataHealthNav"[^>]*hidden') 'Owner Data Health navigation must default to hidden on desktop and mobile.'
Assert-True ($Index -match 'id="mobileSignOutButton"[^>]*hidden') 'Hosted mobile sign-out control is missing.'
Assert-True ($Wife -notmatch '(?i)data health') 'Data Health leaked into Wife Mode.'
Assert-True ($App -match 'session\.role === "owner"') 'Owner navigation is not role-decorated.'
Assert-True ($Feature -match '/api/data-health') 'Data Health view does not load its database-only API.'
Assert-True ($Feature -notmatch '/api/(spotify/sync|tessie)') 'Data Health invokes provider work from the web process.'

Write-Host 'Data Health checks passed.' -ForegroundColor Green
