$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force

$Scratch = Join-Path ([IO.Path]::GetTempPath()) ('driveos-layout-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Scratch | Out-Null
try {
    $Repository = New-DriveOSRepository -DataDirectory $Scratch -Provider Json
    $Record = [PSCustomObject]@{
        version = 1
        updatedAt = '2026-08-12T20:00:00.000Z'
        layout = [PSCustomObject]@{
            order = @('music','vehicle')
            hidden = @('status')
            pinned = @('music')
            positions = [PSCustomObject]@{ music = [PSCustomObject]@{ row = 1; col = 7 } }
            sizes = [PSCustomObject]@{ music = 'standard'; vehicle = 'wide' }
        }
    }
    Set-DriveOSDashboardLayoutRecord -Repository $Repository -LayoutRecord $Record
    $Saved = Get-DriveOSDashboardLayoutRecord -Repository $Repository
    Assert-True ($Saved.version -eq 1) 'Dashboard layout version was not persisted.'
    Assert-True ($Saved.layout.order[0] -eq 'music') 'Dashboard widget order was not persisted.'
    Assert-True ($Saved.layout.positions.music.col -eq 7) 'Dashboard widget position was not persisted.'
}
finally {
    Remove-Item -LiteralPath $Scratch -Recurse -Force
}

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Frontend = Get-Content (Join-Path $Root 'web\features\dashboard-customization.js') -Raw
$ReferenceDashboard = Get-Content (Join-Path $Root 'web\features\reference-dashboard.js') -Raw
$App = Get-Content (Join-Path $Root 'web\app.js') -Raw
$Styles = Get-Content (Join-Path $Root 'web\styles.css') -Raw
Assert-True ($Server -match 'ConvertTo-SafeDashboardLayout') 'Server-side dashboard layout validation is missing.'
Assert-True ($Server -match 'Get-DriveOSDashboardLayoutRecord') 'Dashboard layout read endpoint is not repository-backed.'
Assert-True ($Server -match 'Set-DriveOSDashboardLayoutRecord') 'Dashboard layout write endpoint is not repository-backed.'
Assert-True ($Frontend -match '/api/dashboard/layout') 'Frontend dashboard sync endpoint is missing.'
Assert-True ($Frontend -match 'offline.*saved on this device') 'Offline dashboard fallback is missing.'
Assert-True ($Frontend -match 'remoteTime\s*>=\s*localTime') 'Dashboard conflict resolution is missing.'
foreach ($Setter in @('setStatus','setVehicle','setSpotify','setDrives')) {
    Assert-True ($ReferenceDashboard -match "function $Setter\(") "Reference dashboard is missing the direct $Setter live-data binding."
    Assert-True ($App -match "DriveOSReferenceDashboard\?\.$Setter\(") "Application API loaders do not publish $Setter data to the reference dashboard."
}
Assert-True ($Styles -match 'Cinematic five-button mobile navigation shared by local, Tailnet, and production') 'The production mobile navigation contract is missing.'
Assert-True (-not ($Styles -match ':root\.local-host \.main-nav\.mobile-nav-portal')) 'The cinematic mobile navigation is still limited to localhost.'
Assert-True ($Styles -match 'grid-template-columns:repeat\(5,minmax\(0,1fr\)\)') 'The mobile navigation must retain five equal actions.'
Assert-True ($App -match 'journeydeck:viewchange[\s\S]{0,180}view\s*===\s*["'']timeline["''][\s\S]{0,100}loadDriveTimeline') 'The mobile More menu cannot start Journey Timeline loading.'
Assert-True ($App -match 'loadDashboardDrives[\s\S]{0,900}moments\?\.setJourneys\(recent\)') 'The Moments page does not hydrate immediately from real recent journeys.'
Assert-True ($App -match 'journeydeck:viewchange[\s\S]{0,180}view\s*===\s*["'']drives["''][\s\S]{0,120}loadDrives') 'Direct and mobile Moments navigation cannot start full Journey-library loading.'

Write-Host 'DriveOS dashboard layout sync checks passed.' -ForegroundColor Green
