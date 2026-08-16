$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Equal($Actual,$Expected,[string]$Message){if($Actual -ne $Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

Import-Module (Join-Path $Root 'src\Application\DriveOS.MobilityGraph.psm1') -Force
$Drives = @(
    [PSCustomObject]@{id='one';startedAt='2026-08-01T12:00:00Z';startingLocation='Home';endingLocation='Work';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.75;endingLongitude=-97.10;miles=18;durationMinutes=30;efficiencyWhMi=240},
    [PSCustomObject]@{id='two';startedAt='2026-08-02T12:00:00Z';startingLocation='Work';endingLocation='Home';startingLatitude=32.7504;startingLongitude=-97.1004;endingLatitude=32.9003;endingLongitude=-97.3003;miles=18.5;durationMinutes=32;efficiencyWhMi=250},
    [PSCustomObject]@{id='three';startedAt='2026-08-03T12:00:00Z';startingLocation='Home';endingLocation='Gym';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.82;endingLongitude=-97.22;miles=8;durationMinutes=15;efficiencyWhMi=230},
    [PSCustomObject]@{id='four';startedAt='2026-07-01T12:00:00Z';startingLocation='Home';endingLocation='Work';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.75;endingLongitude=-97.10;miles=18;durationMinutes=31;efficiencyWhMi=245},
    [PSCustomObject]@{id='five';startedAt='2026-07-02T12:00:00Z';startingLocation='Work';endingLocation='Home';startingLatitude=32.75;startingLongitude=-97.10;endingLatitude=32.90;endingLongitude=-97.30;miles=18.5;durationMinutes=33;efficiencyWhMi=255},
    [PSCustomObject]@{id='six';startedAt='2026-08-04T12:00:00Z';startingLocation='Home';endingLocation='Work';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.75;endingLongitude=-97.10;miles=19;durationMinutes=34;efficiencyWhMi=248}
)
$Graph = New-DriveOSMobilityGraph -Drives $Drives -WindowDays 365 -AsOfUtc ([DateTimeOffset]'2026-08-16T00:00:00Z')
Assert-Equal $Graph.version 3 'Mobility correction contract version changed.'
Assert-Equal $Graph.summary.placeCount 3 'Nearby repeated endpoints were not clustered into stable places.'
Assert-Equal $Graph.summary.connectionCount 3 'Directed mobility connections were not aggregated correctly.'
Assert-Equal $Graph.summary.driveCount 6 'Mobility graph drive coverage is incorrect.'
Assert-Equal $Graph.summary.totalMiles 100 'Mobility graph mileage is incorrect.'
Assert-Equal $Graph.nodes[0].label 'Home' 'Most-visited place ranking is incorrect.'
Assert-Equal $Graph.nodes[0].visitCount 6 'Unique visits to the top place are incorrect.'
Assert-Equal $Graph.nodes[0].category 'home' 'Home identity was not inferred from saved place evidence.'
Assert-Equal @($Graph.nodes | Where-Object label -eq 'Work')[0].category 'work' 'Work identity was not inferred.'
Assert-Equal @($Graph.nodes | Where-Object label -eq 'Gym')[0].category 'wellness' 'Wellness identity was not inferred.'
Assert-True ($Graph.nodes.id -notcontains $null) 'A graph node lacks a stable ID.'
Assert-True ($Graph.edges[0].driveIds.Count -ge 1) 'Graph edges must retain drill-down drive IDs.'
Assert-Equal $Graph.routines.Count 1 'The recurring Home/Work route was not detected.'
Assert-Equal $Graph.routines[0].type 'commute' 'Home/Work evidence did not produce a commute routine.'
Assert-Equal $Graph.routines[0].driveCount 5 'Routine evidence count is incorrect.'
Assert-Equal $Graph.routines[0].typicalTime 'morning' 'Routine time bands must use the JourneyDeck Central time zone.'
Assert-Equal $Graph.periodComparison.recent.driveCount 4 'Recent comparison window is incorrect.'
Assert-Equal $Graph.periodComparison.prior.driveCount 2 'Prior comparison window is incorrect.'
Assert-True (@($Graph.changeInsights | Where-Object type -eq 'activity-change').Count -eq 1) 'Activity change insight is missing.'
$WorkNode = @($Graph.nodes | Where-Object label -eq 'Work')[0]
$Commute = $Graph.routines[0]
$CorrectedGraph = New-DriveOSMobilityGraph -Drives $Drives -WindowDays 365 -AsOfUtc ([DateTimeOffset]'2026-08-16T00:00:00Z') -Preferences ([PSCustomObject]@{
    places = @([PSCustomObject]@{nodeId=$WorkNode.id;name="Nicholas's School";category='family'})
    routines = @([PSCustomObject]@{routineId=$Commute.id;status='confirmed';type='school-run';customName=''})
})
$CorrectedPlace = @($CorrectedGraph.nodes | Where-Object id -eq $WorkNode.id)[0]
Assert-Equal $CorrectedPlace.label "Nicholas's School" 'Manual place name did not override inference.'
Assert-Equal $CorrectedPlace.category 'family' 'Manual place category did not override inference.'
Assert-Equal $CorrectedPlace.categoryConfidence 'manual' 'Manual place identity is not labeled as manual.'
Assert-Equal $CorrectedGraph.routines[0].type 'school-run' 'Confirmed routine type did not override inference.'
Assert-Equal $CorrectedGraph.routines[0].confirmationStatus 'confirmed' 'Routine confirmation state was not applied.'
$IdentityGraph = New-DriveOSMobilityGraph -Drives @(
    [PSCustomObject]@{id='errand';startedAt='2026-08-10T18:00:00Z';startingLocation='Mom and Dad';endingLocation='Target Grocery Store';miles=3;durationMinutes=8}
) -AsOfUtc ([DateTimeOffset]'2026-08-16T00:00:00Z')
Assert-Equal @($IdentityGraph.nodes | Where-Object label -eq 'Mom and Dad')[0].category 'family' 'Family identity was not inferred.'
Assert-Equal @($IdentityGraph.nodes | Where-Object label -eq 'Target Grocery Store')[0].category 'errands' 'Errand identity was not inferred.'

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Index = Get-Content (Join-Path $Root 'web\index.html') -Raw
Assert-True ($Server -match 'DriveOS\.MobilityGraph\.psm1') 'Mobility graph application module is not loaded.'
Assert-True ($Server -match '"/api/mobility-graph"') 'Mobility graph read endpoint is missing.'
Assert-True ($Server -match 'New-DriveOSMobilityGraph\s+-Drives\s+\$Drives') 'Mobility graph endpoint does not project the retained drive cache.'
Assert-True ($Index -match 'id="view-graph"') 'Mobility graph view is missing.'
Assert-True ($Index -match 'id="mobilityRoutines"') 'Recurring pattern intelligence is missing from the graph view.'
Assert-True ($Index -match 'id="mobilityChanges"') 'Change intelligence is missing from the graph view.'
Assert-True ($Index -match 'features/mobility-graph\.js') 'Mobility graph frontend module is not loaded.'
Write-Host 'Personal Mobility Graph checks passed.' -ForegroundColor Green
