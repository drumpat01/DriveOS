$ErrorActionPreference='Stop';$Root=Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Application\DriveOS.Assistant.psm1') -Force
function Assert-True([bool]$Condition,[string]$Message){if(-not$Condition){throw $Message}}

$Drives=@(
    [pscustomobject]@{id='short';startedAt=[DateTimeOffset]::Now.AddDays(-2).ToString('o');miles=32.5;energyKWh=7.15;dateLabel='Monday';startingLocation='Home';endingLocation='Office';efficiencyWhMi=220;soundtrack=@([pscustomobject]@{track='City Lights';artist='Nova Lane';playedAt=[DateTimeOffset]::Now.AddDays(-2).AddMinutes(5).ToString('o')})},
    [pscustomobject]@{id='long';startedAt=[DateTimeOffset]::Now.AddDays(-10).ToString('o');miles=88.2;energyKWh=22.93;dateLabel='Last week';startingLocation='Home';endingLocation='Austin';rawEndingLocation='Downtown Austin';efficiencyWhMi=260;soundtrack=@([pscustomobject]@{track='Open Roads';artist='Nova Lane';playedAt=[DateTimeOffset]::Now.AddDays(-10).AddMinutes(5).ToString('o')})}
)
$UnattachedHistory=@([pscustomobject]@{track='Not While Driving';artist='Decoy';played_at=[DateTimeOffset]::Now.AddMinutes(-5).ToString('o');source='spotify'})

$Longest=Get-DriveOSAssistantAnswer -Question 'What was my longest drive?' -Drives $Drives
Assert-True ($Longest.operation-eq'longest_drive'-and$Longest.answer-match'88.2') 'Longest-drive questions must use normalized drive records.'
$Distance=Get-DriveOSAssistantAnswer -Question 'How many miles did I drive this month?' -Drives $Drives
Assert-True ($Distance.operation-eq'drive_distance'-and$Distance.answer-match'120.7') 'Distance questions must use the calendar-month window.'
$Count=Get-DriveOSAssistantAnswer -Question 'How many drives this month?' -Drives $Drives
Assert-True ($Count.operation-eq'drive_count'-and$Count.answer-match'2 drives') 'Drive-count questions must use the requested date window.'
$Artist=Get-DriveOSAssistantAnswer -Question 'Who is my top artist?' -Drives $Drives -History $UnattachedHistory
Assert-True ($Artist.operation-eq'top_artists'-and$Artist.answer-match'Nova Lane'-and$Artist.answer-match'while driving') 'Top-artist questions escaped the while-driving boundary.'
$Latest=Get-DriveOSAssistantAnswer -Question 'What was my latest song?' -Drives $Drives -History $UnattachedHistory
Assert-True ($Latest.operation-eq'latest_track'-and$Latest.answer-match'City Lights'-and$Latest.answer-notmatch'Not While Driving') 'Latest-track questions used unattached listening history.'
$Efficiency=Get-DriveOSAssistantAnswer -Question 'What was my average efficiency this month?' -Drives $Drives
Assert-True ($Efficiency.operation-eq'average_efficiency'-and$Efficiency.answer-match'249 Wh/mi') 'Average efficiency must use total energy divided by total miles.'
$Destination=Get-DriveOSAssistantAnswer -Question 'How many times have I driven to Austin?' -Drives $Drives
Assert-True ($Destination.operation-eq'destination_count'-and$Destination.answer-match'1 drive') 'Destination questions must match normalized ending locations.'
$DriveMusic=Get-DriveOSAssistantAnswer -Question 'What music did I listen to on my drive to Austin?' -Drives $Drives
Assert-True ($DriveMusic.operation-eq'drive_music'-and$DriveMusic.answer-match'Open Roads') 'Drive-music questions must use the matching drive soundtrack.'

$Now=[DateTimeOffset]::Parse('2026-08-16T12:00:00-05:00')
$YearDrives=@(
    [pscustomobject]@{id='2025';startedAt='2025-12-31T23:30:00-06:00';soundtrack=@([pscustomobject]@{track='Old Winner';artist='Decoy';playedAt='2025-12-31T23:35:00-06:00'})},
    [pscustomobject]@{id='2026-a';startedAt='2026-01-01T00:30:00-06:00';soundtrack=@([pscustomobject]@{track='Driving Winner';artist='Road Artist';playedAt='2026-01-01T00:35:00-06:00'},[pscustomobject]@{track='Driving Winner';artist='Road Artist';playedAt='2026-01-01T00:38:00-06:00'})},
    [pscustomobject]@{id='2026-b';startedAt='2026-07-01T12:00:00-05:00';soundtrack=@([pscustomobject]@{track='Runner Up';artist='Road Artist';playedAt='2026-07-01T12:05:00-05:00'})}
)
$YearAnswer=Get-DriveOSAssistantAnswer -Question 'What was my most-played track of 2026?' -Drives $YearDrives -History @([pscustomobject]@{track='Outside Car';artist='Decoy';played_at='2026-06-01T12:00:00Z'}) -Now $Now
Assert-True ($YearAnswer.operation-eq'top_tracks'-and$YearAnswer.answer-match'Driving Winner'-and$YearAnswer.answer-match'2 plays'-and$YearAnswer.answer-match'while driving') 'Calendar-year driving-track aggregation is incorrect.'
Assert-True ($YearAnswer.filters.scope-eq'while_driving'-and$YearAnswer.filters.rangeLabel-eq'2026 so far'-and$YearAnswer.filters.rangeStart-eq'2026-01-01T06:00:00.0000000+00:00') 'The assistant did not expose its calendar range and driving scope.'
Assert-True ($YearAnswer.answer-notmatch'Old Winner|Outside Car') 'Out-of-range or unattached music influenced the answer.'

$Charging=Get-DriveOSAssistantAnswer -Question 'How much did I charge this month?' -Drives $Drives
Assert-True ($Charging.operation-eq'unsupported'-and$Charging.answer-match'while driving') 'Charging escaped the driving-only search rule.'
$Unsupported=Get-DriveOSAssistantAnswer -Question 'Change my charging price' -Drives $Drives
Assert-True ($Unsupported.operation-eq'unsupported') 'Unsupported assistant requests must not mutate or invoke arbitrary operations.'
$Server=Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw;$Tokens=$null;$Errors=$null;$Ast=[Management.Automation.Language.Parser]::ParseInput($Server,[ref]$Tokens,[ref]$Errors);$ServerAssistant=$Ast.Find({param($Node)$Node-is[Management.Automation.Language.FunctionDefinitionAst]-and$Node.Name-eq'Get-AssistantAnswer'},$true).Extent.Text
Assert-True ($ServerAssistant-match'Get-CachedRecentDrives730'-and$ServerAssistant-notmatch'Get-SpotifyHistory|Get-ChargingSummary') 'The server can leak non-driving history into assistant search.'
Write-Host 'JourneyDeck driving-only assistant checks passed.' -ForegroundColor Green
