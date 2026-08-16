$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Equal($Actual,$Expected,[string]$Message){if($Actual -ne $Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

Import-Module (Join-Path $Root 'src\Application\DriveOS.MobilityGraph.psm1') -Force
$Drives = @(
    [PSCustomObject]@{id='one';startedAt='2026-08-01T12:00:00Z';startingLocation='Home';endingLocation='Work';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.75;endingLongitude=-97.10;miles=18;durationMinutes=30;efficiencyWhMi=240},
    [PSCustomObject]@{id='two';startedAt='2026-08-02T12:00:00Z';startingLocation='Work';endingLocation='Home';startingLatitude=32.7504;startingLongitude=-97.1004;endingLatitude=32.9003;endingLongitude=-97.3003;miles=18.5;durationMinutes=32;efficiencyWhMi=250},
    [PSCustomObject]@{id='three';startedAt='2026-08-03T12:00:00Z';startingLocation='Home';endingLocation='Gym';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.82;endingLongitude=-97.22;miles=8;durationMinutes=15;efficiencyWhMi=230}
)
$Graph = New-DriveOSMobilityGraph -Drives $Drives -WindowDays 365
Assert-Equal $Graph.version 1 'Mobility graph contract version changed.'
Assert-Equal $Graph.summary.placeCount 3 'Nearby repeated endpoints were not clustered into stable places.'
Assert-Equal $Graph.summary.connectionCount 3 'Directed mobility connections were not aggregated correctly.'
Assert-Equal $Graph.summary.driveCount 3 'Mobility graph drive coverage is incorrect.'
Assert-Equal $Graph.summary.totalMiles 44.5 'Mobility graph mileage is incorrect.'
Assert-Equal $Graph.nodes[0].label 'Home' 'Most-visited place ranking is incorrect.'
Assert-Equal $Graph.nodes[0].visitCount 3 'Unique visits to the top place are incorrect.'
Assert-True ($Graph.nodes.id -notcontains $null) 'A graph node lacks a stable ID.'
Assert-True ($Graph.edges[0].driveIds.Count -ge 1) 'Graph edges must retain drill-down drive IDs.'

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Index = Get-Content (Join-Path $Root 'web\index.html') -Raw
Assert-True ($Server -match 'DriveOS\.MobilityGraph\.psm1') 'Mobility graph application module is not loaded.'
Assert-True ($Server -match '"/api/mobility-graph"') 'Mobility graph read endpoint is missing.'
Assert-True ($Server -match 'New-DriveOSMobilityGraph\s+-Drives\s+\$Drives') 'Mobility graph endpoint does not project the retained drive cache.'
Assert-True ($Index -match 'id="view-graph"') 'Mobility graph view is missing.'
Assert-True ($Index -match 'features/mobility-graph\.js') 'Mobility graph frontend module is not loaded.'
Write-Host 'Personal Mobility Graph checks passed.' -ForegroundColor Green
