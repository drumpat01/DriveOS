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
Assert-True ($Server -match 'ConvertTo-SafeDashboardLayout') 'Server-side dashboard layout validation is missing.'
Assert-True ($Server -match 'Get-DriveOSDashboardLayoutRecord') 'Dashboard layout read endpoint is not repository-backed.'
Assert-True ($Server -match 'Set-DriveOSDashboardLayoutRecord') 'Dashboard layout write endpoint is not repository-backed.'
Assert-True ($Frontend -match '/api/dashboard/layout') 'Frontend dashboard sync endpoint is missing.'
Assert-True ($Frontend -match 'offline.*saved on this device') 'Offline dashboard fallback is missing.'
Assert-True ($Frontend -match 'remoteTime\s*>=\s*localTime') 'Dashboard conflict resolution is missing.'

Write-Host 'DriveOS dashboard layout sync checks passed.' -ForegroundColor Green
