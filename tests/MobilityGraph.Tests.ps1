$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
function Assert-True([bool]$Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Equal($Actual,$Expected,[string]$Message){if($Actual -ne $Expected){throw "$Message Expected '$Expected', got '$Actual'."}}

Import-Module (Join-Path $Root 'src\Application\DriveOS.MobilityGraph.psm1') -Force
$Drives = @(
    [PSCustomObject]@{id='one';startedAt='2026-08-01T12:00:00Z';startingLocation='Home';rawStartingLocation='100 Home St';endingLocation='Work';rawEndingLocation='200 Work Ave';startingLatitude=32.90;startingLongitude=-97.30;endingLatitude=32.75;endingLongitude=-97.10;miles=18;durationMinutes=30;efficiencyWhMi=240},
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
Assert-Equal $Graph.nodes[0].address '100 Home St' 'The mobility graph must preserve the underlying Tessie address.'
Assert-Equal @($Graph.nodes | Where-Object label -eq 'Work')[0].category 'work' 'Work identity was not inferred.'
Assert-Equal @($Graph.nodes | Where-Object label -eq 'Gym')[0].category 'wellness' 'Wellness identity was not inferred.'
Assert-True ($Graph.nodes.id -notcontains $null) 'A graph node lacks a stable ID.'
Assert-True ($Graph.edges[0].driveIds.Count -ge 1) 'Graph edges must retain drill-down drive IDs.'
Assert-Equal $Graph.routines.Count 1 'The recurring Home/Work route was not detected.'
Assert-Equal $Graph.routines[0].type 'commute' 'Home/Work evidence did not produce a commute routine.'
Assert-Equal $Graph.routines[0].driveCount 5 'Routine evidence count is incorrect.'
Assert-True (-not [string]::IsNullOrWhiteSpace($Graph.routines[0].sourceAddress)) 'Routine details must expose endpoint addresses.'
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

$ImportedGraph = New-DriveOSMobilityGraph -Drives @(
    [PSCustomObject]@{id='legacy-placeholder';startedAt='2026-06-01T12:00:00Z';startingLocation='Google Timeline location';endingLocation='Google Timeline location';miles=1;durationMinutes=4},
    [PSCustomObject]@{id='import-one';startedAt='2026-06-02T12:00:00Z';startingLocation='Google Timeline location';endingLocation='Google Timeline location';startingLatitude=32.900;startingLongitude=-97.300;endingLatitude=32.750;endingLongitude=-97.100;miles=18;durationMinutes=30},
    [PSCustomObject]@{id='import-two';startedAt='2026-06-03T12:00:00Z';startingLocation='Google Timeline location';endingLocation='Google Timeline location';startingLatitude=32.9002;startingLongitude=-97.3002;endingLatitude=32.7502;endingLongitude=-97.1002;miles=18.2;durationMinutes=31},
    [PSCustomObject]@{id='import-three';startedAt='2026-06-04T12:00:00Z';startingLocation='Google Timeline location';endingLocation='Google Timeline location';startingLatitude=32.9001;startingLongitude=-97.3001;endingLatitude=32.7501;endingLongitude=-97.1001;miles=18.1;durationMinutes=29}
) -AsOfUtc ([DateTimeOffset]'2026-08-16T00:00:00Z')
Assert-Equal $ImportedGraph.summary.placeCount 3 'A coordinate-less Timeline placeholder absorbed distinct imported places.'
Assert-Equal $ImportedGraph.routines.Count 1 'Repeated imported coordinates did not produce a recurring pattern.'
Assert-Equal $ImportedGraph.routines[0].driveCount 3 'Imported journey evidence was not counted individually.'

$HomeFence = [PSCustomObject]@{name='Home';category='home';latitude=35.123456;longitude=-96.654321;radiusFeet=200}
$HomeFenceGraph = New-DriveOSMobilityGraph -Drives @(
    [PSCustomObject]@{id='home-fence';startedAt='2026-08-10T12:00:00Z';startingLocation='Legacy Vendor Label';endingLocation='Store';startingLatitude=35.123456;startingLongitude=-96.654321;endingLatitude=35.20;endingLongitude=-96.80;miles=8;durationMinutes=15}
) -Preferences ([PSCustomObject]@{placeGeofences=@($HomeFence);places=@();routines=@()})
$CorrectedHome = @($HomeFenceGraph.nodes | Where-Object category -eq 'home')[0]
Assert-Equal $CorrectedHome.label 'Home' 'The 200-foot Home geofence did not override the Foursquare business label.'
Assert-Equal $HomeFenceGraph.placeGeofences[0].radiusFeet 200 'The graph response does not expose the persisted Home radius.'

$ConsolidatedHomeGraph = New-DriveOSMobilityGraph -Drives @(
    [PSCustomObject]@{id='legacy-home-out';startedAt='2026-08-10T12:00:00Z';startingLocation='Home';endingLocation='Store';endingLatitude=32.90;endingLongitude=-97.50;miles=8;durationMinutes=15},
    [PSCustomObject]@{id='located-home-in';startedAt='2026-08-11T12:00:00Z';startingLocation='Store';endingLocation='Legacy Vendor Label';startingLatitude=35.20;startingLongitude=-96.80;endingLatitude=35.123456;endingLongitude=-96.654321;miles=8;durationMinutes=15},
    [PSCustomObject]@{id='home-self-loop';startedAt='2026-08-12T12:00:00Z';startingLocation='Home';endingLocation='Legacy Vendor Label';endingLatitude=35.123456;endingLongitude=-96.654321;miles=.1;durationMinutes=2}
) -Preferences ([PSCustomObject]@{placeGeofences=@($HomeFence);places=@();routines=@()})
$ConsolidatedHomes = @($ConsolidatedHomeGraph.nodes | Where-Object category -eq 'home')
Assert-Equal $ConsolidatedHomes.Count 1 'Coordinate-less and geofenced Home records were not consolidated.'
Assert-Equal $ConsolidatedHomes[0].visitCount 3 'The consolidated Home visit count did not preserve every journey.'
Assert-Equal @($ConsolidatedHomeGraph.edges | Where-Object { $_.source -eq $ConsolidatedHomes[0].id -and $_.target -eq $ConsolidatedHomes[0].id }).Count 0 'A merged Home-to-Home connection remained visible.'

$HomeLoopBase = New-DriveOSMobilityGraph -Drives @(
    1..3 | ForEach-Object { [PSCustomObject]@{id="home-loop-$_";startedAt="2026-08-0$($_)T12:00:00Z";startingLocation='House A';endingLocation='House B';startingLatitude=32.84;startingLongitude=-97.37;endingLatitude=33.2;endingLongitude=-97.8;miles=40;durationMinutes=50} }
)
$HomeLoopGraph = New-DriveOSMobilityGraph -Drives @(
    1..3 | ForEach-Object { [PSCustomObject]@{id="home-loop-$_";startedAt="2026-08-0$($_)T12:00:00Z";startingLocation='House A';endingLocation='House B';startingLatitude=32.84;startingLongitude=-97.37;endingLatitude=33.2;endingLongitude=-97.8;miles=40;durationMinutes=50} }
) -Preferences ([PSCustomObject]@{places=@($HomeLoopBase.nodes | ForEach-Object { [PSCustomObject]@{nodeId=$_.id;name='Home';category='home'} });routines=@();placeGeofences=@()})
Assert-Equal $HomeLoopGraph.routines.Count 0 'A Home-to-Home recurring pattern must never be shown.'

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$Index = Get-Content (Join-Path $Root 'web\index.html') -Raw
Assert-True ($Server -match 'DriveOS\.MobilityGraph\.psm1') 'Mobility graph application module is not loaded.'
Assert-True ($Server -match '"/api/mobility-graph"') 'Mobility graph read endpoint is missing.'
Assert-True ($Server -match 'New-DriveOSMobilityGraph\s+-Drives\s+\$Drives') 'Mobility graph endpoint does not project the retained drive cache.'
Assert-True ($Index -match 'id="view-graph"') 'Mobility graph view is missing.'
Assert-True ($Index -match 'id="mobilityRoutines"') 'Recurring pattern intelligence is missing from the graph view.'
Assert-True ($Index -match 'id="mobilityChanges"') 'Change intelligence is missing from the graph view.'
Assert-True ($Index -match 'features/mobility-graph\.js') 'Mobility graph frontend module is not loaded.'
$Frontend = Get-Content (Join-Path $Root 'web\features\mobility-graph.js') -Raw
Assert-True ($Frontend -match "api\.get\('/api/atlas/places'" -and $Frontend -notmatch "api\.post\('/api/atlas/places/scan'") 'Atlas must read persisted enrichment without starting provider calls during page load.'
Assert-True ($Frontend -match 'changeInsights\)\?graph\.changeInsights:\[\]\)\.slice\(0,3\)') 'Atlas change insights are not capped at three cards.'
Assert-True ($Frontend -match 'removeImportedPlaceArtifacts' -and $Frontend -match 'data-save-card-place') 'Atlas must hide unresolved import artifacts and support card relabeling.'
Assert-True ($Frontend -match 'moments when Home anchored your journey' -and $Frontend -match 'function consolidateHomeNodes') 'Home must be consolidated locally and render as one compact informational count instead of a repeated identity editor.'
Assert-True ($Frontend -match 'placeSaveQueue' -and $Frontend -match 'applySavedCardLabel' -and $Frontend -notmatch "saveCardPlace[^{]*\{[^}]+await mutate") 'Card place labels must save serially in place without rebuilding Atlas after each correction.'
Assert-True ($Frontend -match 'sourceLabel:aLabel,targetLabel:bLabel') 'Generated recurring patterns must retain resolved display labels for reliable editing.'
Assert-True ($Frontend -match "api\.post\('/api/mobility/place-geofence'" -and $Frontend -match 'radiusFeet:200') 'Coordinate-backed card labels must persist as stable place geofences.'
Assert-True ($Frontend -match '/api/mobility/place-geofence' -and $Frontend -match '/api/atlas/places') 'Atlas place labels must use durable authenticated APIs.'
Assert-True ($Frontend -notmatch 'localStorage\.setItem\(savedPlaceLabelsStorageKey') 'Precise Atlas place labels must not be duplicated into persistent browser storage.'
Assert-True ($Frontend -match 'mapDrives=retainedDrives' -and $Frontend -match 'representativeJourneyFeatures\(mapDrives,200\)') 'Atlas representative lines must use the complete journey response instead of mutable dashboard state.'
Assert-True ($Server -match 'function Get-PlaceCandidates\s*\{\s*param\(\[switch\]\$Enrich\)' -and $Server -match 'Get-PlaceCandidates -Enrich') 'Provider enrichment must require the explicit Atlas scan path.'
$Migration = Get-Content (Join-Path $Root 'tools\Invoke-AtlasPlaceMigration.ps1') -Raw
Assert-True ($Migration -match 'Set-DriveOSTursoState[^\r\n]+foursquare-usage[^\r\n]+\$NewUsage\s*\r?\n\s*\$Places\s*=') 'Atlas migration must reserve each provider call durably before issuing it.'
Assert-True ($Frontend -match 'routineSaveQueue' -and $Frontend -match "routineIds\.forEach\(rememberReviewedRoutine\)[\s\S]+renderIntelligence\(\)[\s\S]+api\.post\('/api/mobility/routine'" -and $Frontend -notmatch 'reviewRoutine[^{]*\{[^}]+await load') 'Routine reviews must disappear optimistically and sync serially without rebuilding Atlas.'
Assert-True ($Frontend -match 'routineIds\.forEach\(forgetReviewedRoutine\)' -and $Frontend -match 'Save failed.+ready to retry') 'Failed routine writes must restore the card so the review is never silently lost.'
Assert-True ($Frontend -match 'function deduplicateRoutines' -and $Frontend -match 'relatedRoutineIds' -and $Frontend -match 'for\(const id of routineIds\)') 'Equivalent imported routine cards must consolidate and persist one review across every underlying routine.'
Assert-True ($Index -match 'mobilityGraphInspector[\s\S]+mobilityChanges') 'Change insights are not positioned in the Atlas sidebar.'
Write-Host 'Personal Mobility Graph checks passed.' -ForegroundColor Green
