$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Application\DriveOS.Assistant.psm1') -Force

$Drives = @(
    [pscustomobject]@{ id='short'; startedAt=[DateTimeOffset]::Now.AddDays(-2).ToString('o'); miles=32.5; energyKWh=7.15; dateLabel='Monday'; startingLocation='Home'; endingLocation='Office'; efficiencyWhMi=220 },
    [pscustomobject]@{ id='long'; startedAt=[DateTimeOffset]::Now.AddDays(-10).ToString('o'); miles=88.2; energyKWh=22.93; dateLabel='Last week'; startingLocation='Home'; endingLocation='Austin'; rawEndingLocation='Downtown Austin'; efficiencyWhMi=260; soundtrack=@([pscustomobject]@{track='Open Roads';artist='Nova Lane';playedAt=[DateTimeOffset]::Now.AddDays(-10).ToString('o')}) }
)
$History = @(
    [pscustomobject]@{ track='Open Roads'; artist='Nova Lane'; playedAt=[DateTimeOffset]::Now.AddMinutes(-5).ToString('o'); source='spotify' },
    [pscustomobject]@{ track='City Lights'; artist='Nova Lane'; playedAt=[DateTimeOffset]::Now.AddHours(-1).ToString('o'); source='spotify' },
    [pscustomobject]@{ track='Northbound'; artist='Paper Satellites'; playedAt=[DateTimeOffset]::Now.AddHours(-2).ToString('o'); source='spotify' }
)

$Longest = Get-DriveOSAssistantAnswer -Question 'What was my longest drive?' -Drives $Drives
if ($Longest.operation -ne 'longest_drive' -or $Longest.answer -notmatch '88.2') { throw 'Longest-drive questions must use normalized drive records.' }

$Distance = Get-DriveOSAssistantAnswer -Question 'How many miles did I drive this month?' -Drives $Drives
if ($Distance.operation -ne 'drive_distance' -or $Distance.answer -notmatch '120.7') { throw 'Distance questions must not be misclassified as drive-count questions.' }

$Count = Get-DriveOSAssistantAnswer -Question 'How many drives this month?' -Drives $Drives
if ($Count.operation -ne 'drive_count' -or $Count.answer -notmatch '2 drives') { throw 'Drive-count questions must use the requested date window.' }

$Artist = Get-DriveOSAssistantAnswer -Question 'Who is my top artist?' -History $History
if ($Artist.operation -ne 'top_artists' -or $Artist.answer -notmatch 'Nova Lane') { throw 'Top-artist questions must aggregate normalized Spotify history.' }

$Latest = Get-DriveOSAssistantAnswer -Question 'What was my latest song?' -History $History
if ($Latest.operation -ne 'latest_track' -or $Latest.answer -notmatch 'Open Roads') { throw 'Latest-track questions must sort archived Spotify history by played time.' }

$Efficiency = Get-DriveOSAssistantAnswer -Question 'What was my average efficiency this month?' -Drives $Drives
if ($Efficiency.operation -ne 'average_efficiency' -or $Efficiency.answer -notmatch '249 Wh/mi') { throw 'Average efficiency must use total energy divided by total miles.' }

$Destination = Get-DriveOSAssistantAnswer -Question 'How many times have I driven to Austin?' -Drives $Drives
if ($Destination.operation -ne 'destination_count' -or $Destination.answer -notmatch '1 recorded drive') { throw 'Destination questions must match normalized ending locations.' }

$DriveMusic = Get-DriveOSAssistantAnswer -Question 'What music did I listen to on my drive to Austin?' -Drives $Drives
if ($DriveMusic.operation -ne 'drive_music' -or $DriveMusic.answer -notmatch 'Open Roads') { throw 'Drive-music questions must use the matching drive soundtrack.' }

$Unsupported = Get-DriveOSAssistantAnswer -Question 'Change my charging price' -Drives $Drives
if ($Unsupported.operation -ne 'unsupported') { throw 'Unsupported assistant requests must not mutate or invoke arbitrary operations.' }

Write-Host 'JourneyDeck assistant tests passed.' -ForegroundColor Green
