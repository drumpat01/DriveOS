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
$Styles = Get-Content (Join-Path $Root 'web\styles.css') -Raw

Assert-True ($Server -match '"/api/data-health"') 'Data Health API endpoint is missing.'
Assert-True ($Server -match "Principal\.Role -ne 'owner'") 'Hosted Data Health is not explicitly restricted to the owner role.'
Assert-True ($Server -match 'Get-DriveOSIntegrationSyncCursor.+tessie') 'Data Health does not use durable Tessie cursors.'
Assert-True ($Server -match "Get-DriveOSIntegrationHealthRecord.+spotify") 'Data Health does not use durable Spotify health.'
Assert-True ($Server -match 'Get-DataHealthAlerts') 'Data Health does not produce owner-visible durable alerts.'
Assert-True ($Server -match 'Get-DriveOSLatestIntegrityAuditRun') 'Data Health does not read the latest durable integrity audit.'
$HealthFunction = [regex]::Match($Server, '(?s)function Get-DataHealthSummary\s*\{.*?(?=\r?\n\})').Value
Assert-True ($HealthFunction -notmatch 'Get-RawDrives|Get-SpotifyRecent|New-TessieClient') 'Data Health can call an external provider from the web request process.'
Assert-True ($Index -match 'id="dataHealthNav"[^>]*hidden' -and $Index -match 'id="mobileDataHealthNav"[^>]*hidden') 'Owner Data Health navigation must default to hidden on desktop and mobile.'
Assert-True ($Index -match 'id="mobileSignOutButton"[^>]*hidden') 'Hosted mobile sign-out control is missing.'
Assert-True ($Wife -notmatch '(?i)data health') 'Data Health leaked into Wife Mode.'
Assert-True ($App -match 'session\.role === "owner"') 'Owner navigation is not role-decorated.'
Assert-True ($Feature -match '/api/data-health') 'Data Health view does not load its database-only API.'
Assert-True ($Feature -notmatch '/api/(spotify/sync|tessie)') 'Data Health invokes provider work from the web process.'
Assert-True ($Styles -match 'JourneyDeck application UI consistency') 'The shared application UI consistency layer is missing.'
Assert-True ($Styles -match '(?s)\.data-health-overall,\s*\.data-health-alerts,\s*\.data-health-card,\s*\.data-health-panel,\s*\.data-health-actions\s*\{[^}]*padding:\s*21px 22px') 'Data Health panels can render content against their clipped rounded edges.'
Assert-True ($Styles -match '(?s)\.header-sign-out\s*\{[^}]*border-radius:\s*var\(--ui-control-radius\)[^}]*white-space:\s*nowrap') 'The desktop sign-out control can collapse into a wrapped circle.'
Assert-True ($Styles -match '(?s)@media \(min-width:\s*1121px\)\s*\{\s*\.topbar\s*\{[^}]*grid-template-rows:\s*auto auto') 'The desktop header does not reserve a stable utility row.'

$Tokens = $null
$ParseErrors = $null
$ServerAst = [Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'DriveOS-Server.ps1'), [ref]$Tokens, [ref]$ParseErrors)
Assert-True ($ParseErrors.Count -eq 0) 'DriveOS server must parse cleanly.'
$AlertFunction = $ServerAst.FindAll({ param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq 'Get-DataHealthAlerts' }, $true) | Select-Object -First 1
Assert-True ($null -ne $AlertFunction) 'Data Health alert helper is missing.'
Invoke-Expression $AlertFunction.Extent.Text
$HealthyAlerts = @(Get-DataHealthAlerts -Signals @([pscustomobject]@{ id='spotify'; name='Spotify'; status='healthy' }) -SoundtrackProjection ([pscustomobject]@{ missingCount=0 }) -Rollout ([pscustomobject]@{ tessieWritesEnabled=$true; tessieReadsEnabled=$true; readCanaryApproved=$true }) -RepositoryProvider Turso -IsWeb $true)
Assert-True ($HealthyAlerts.Count -eq 0) 'Healthy production state should not generate alerts.'
$ProblemAlerts = @(Get-DataHealthAlerts -Signals @([pscustomobject]@{ id='spotify'; name='Spotify'; status='failed'; lastError='worker failed' },[pscustomobject]@{ id='tessie-drives'; name='Tessie drives'; status='stale'; lagMinutes=61 }) -SoundtrackProjection ([pscustomobject]@{ missingCount=2 }) -Rollout ([pscustomobject]@{ tessieWritesEnabled=$false; tessieReadsEnabled=$false; readCanaryApproved=$false }) -RepositoryProvider SQLite -IsWeb $true)
foreach ($Expected in @('spotify-failed','tessie-drives-stale','soundtracks-missing','database-provider','tessie-writes','tessie-reads','read-canary')) { Assert-True ($ProblemAlerts.id -contains $Expected) "Missing Data Health alert: $Expected" }
Assert-True (@(Get-DataHealthAlerts -Signals @([pscustomobject]@{ id='integrity-audit'; name='Daily integrity audit'; status='stale'; lagMinutes=1600 }) | Where-Object id -eq 'integrity-audit-stale').Count -eq 1) 'A stale durable audit does not create an owner alert.'
Assert-True ($Index -match 'id="dataHealthAlerts"' -and $Index -match 'id="dataHealthNavAlertCount"' -and $Index -match 'id="mobileDataHealthAlertCount"') 'Data Health alert UI is incomplete on desktop or mobile.'
Assert-True ($Index -match 'id="dataHealthIntegrityAudit"' -and $Feature -match 'integrityAudit') 'Data Health does not display the durable audit result.'
Assert-True ($App -match 'dataHealthFeature\.load\(\)') 'Owner navigation does not proactively load durable alert status.'

Write-Host 'Data Health checks passed.' -ForegroundColor Green
