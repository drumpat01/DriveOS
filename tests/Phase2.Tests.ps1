$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Vehicle\DriveOS.Vehicle.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Replay\DriveOS.Replay.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Places\DriveOS.Places.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Charging\DriveOS.Charging.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Analytics\DriveOS.Analytics.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Drives\DriveOS.Drives.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Recaps\DriveOS.Recaps.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.Playlists.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.ShareCards.psm1') -Force
Import-Module (Join-Path $Root 'src\Http\DriveOS.Http.psm1') -Force

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -ne $Expected) { throw "$Message Expected '$Expected', got '$Actual'." }
}

$scratch = Join-Path ([IO.Path]::GetTempPath()) ('driveos-phase2-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $scratch | Out-Null
try {
    $repository = New-DriveOSRepository -DataDirectory $scratch
    Add-DriveOSListeningHistoryRecord -Repository $repository -Record ([pscustomobject]@{ id='track-1|2026-01-01T00:00:00Z'; played_at='2026-01-01T00:00:00Z' })
    Assert-Equal @(Get-DriveOSListeningHistory -Repository $repository).Count 1 'Listening repository count changed.'
    Set-DriveOSPlaceAliases -Repository $repository -Entries @([pscustomobject]@{location='Test';label='Home'})
    Assert-Equal @(Get-DriveOSPlaceAliases -Repository $repository)[0].label 'Home' 'Alias repository changed.'
    Set-DriveOSChargingSettingsRecord -Repository $repository -Settings ([pscustomobject]@{electricityRateCents=12.5})
    Assert-Equal (Get-DriveOSChargingSettingsRecord -Repository $repository).electricityRateCents 12.5 'Settings repository changed.'

    $sqliteExecutable=Join-Path $Root 'tools\sqlite\sqlite3.exe'
    if(Test-Path -LiteralPath $sqliteExecutable){
        $sqlite=New-DriveOSRepository -DataDirectory $scratch -AppRoot $Root -Provider SQLite
        Initialize-DriveOSSqlite -Repository $sqlite
        $record=[pscustomobject]@{id="track'quoted|2026-01-01T00:00:00Z";played_at='2026-01-01T00:00:00Z';track="Driver's Song"}
        Add-DriveOSListeningHistoryRecord -Repository $sqlite -Record $record
        Add-DriveOSListeningHistoryRecord -Repository $sqlite -Record $record
        Assert-Equal @(Get-DriveOSListeningHistory -Repository $sqlite).Count 1 'SQLite duplicate handling changed.'
        Set-DriveOSPlaceAliases -Repository $sqlite -Entries @([pscustomobject]@{location="Driver's Way";label='Home'})
        Assert-Equal @(Get-DriveOSPlaceAliases -Repository $sqlite)[0].location "Driver's Way" 'SQLite alias quoting changed.'
        Set-DriveOSChargingSettingsRecord -Repository $sqlite -Settings ([pscustomobject]@{electricityRateCents=13.25})
        Assert-Equal (Get-DriveOSChargingSettingsRecord -Repository $sqlite).electricityRateCents 13.25 'SQLite settings changed.'
        if(-not(Test-DriveOSSqliteIntegrity -Repository $sqlite)){throw 'SQLite integrity check failed.'}

        $migrationData=Join-Path $scratch 'migration-data';New-Item -ItemType Directory -Path $migrationData|Out-Null
        $migrationJson=New-DriveOSRepository -DataDirectory $migrationData -AppRoot $Root -Provider Json
        Add-DriveOSListeningHistoryRecord -Repository $migrationJson -Record ([pscustomobject]@{id='one';played_at='2026-01-01T00:00:00Z';track='One'})
        Add-Content -LiteralPath $migrationJson.SpotifyHistoryPath -Value '{malformed' -Encoding UTF8
        Set-DriveOSPlaceAliases -Repository $migrationJson -Entries @([pscustomobject]@{location='A';label='Home'})
        $sourceHash=(Get-FileHash -LiteralPath $migrationJson.SpotifyHistoryPath -Algorithm SHA256).Hash
        & (Join-Path $Root 'tools\Migrate-To-Sqlite.ps1') -AppRoot $Root -DataDirectory $migrationData -NoPause
        $config=Read-DriveOSJson -Path $migrationJson.ConfigPath
        Assert-Equal $config.provider 'SQLite' 'Migration provider switch changed.'
        Assert-Equal (Get-FileHash -LiteralPath $migrationJson.SpotifyHistoryPath -Algorithm SHA256).Hash $sourceHash 'Migration modified the source archive.'
        $migrated=New-DriveOSRepository -DataDirectory $migrationData -AppRoot $Root -Provider Auto
        Assert-Equal @(Get-DriveOSListeningHistory -Repository $migrated).Count 1 'Migration tolerant import changed.'
        & (Join-Path $Root 'tools\Rollback-To-Json.ps1') -AppRoot $Root -DataDirectory $migrationData -NoPause
        Assert-Equal (Read-DriveOSJson -Path $migrationJson.ConfigPath).provider 'Json' 'Rollback provider switch changed.'
    }else{Write-Warning 'SQLite runtime unavailable; SQLite provider tests skipped.'}

    $vehicle = Get-Content (Join-Path $PSScriptRoot 'fixtures\vehicle.json') -Raw | ConvertFrom-Json
    $summary = ConvertTo-DriveOSVehicleSummary -Vehicle $vehicle
    Assert-Equal $summary.name 'Test Vehicle' 'Vehicle name changed.'
    Assert-Equal $summary.rangeMiles 185 'Vehicle range rounding changed.'
    Assert-Equal $summary.insideTempF 68 'Vehicle temperature conversion changed.'
    Assert-Equal $summary.latitude 32.75 'Vehicle current latitude mapping changed.'
    Assert-Equal $summary.heading 194 'Vehicle heading mapping changed.'
    Assert-Equal $summary.odometerMiles 14096.49 'Vehicle odometer mapping changed.'

    $states = @(
        [pscustomobject]@{timestamp=100;latitude=32.1;longitude=-97.1;speed=10;heading=90;battery_level=70},
        [pscustomobject]@{timestamp=110;latitude=32.2;longitude=-97.2;speed=20;heading=95;battery_level=69}
    )
    $nearest = Find-NearestDriveOSHistoricalState -States $states -TargetTimestamp 108
    Assert-Equal $nearest.timestamp 110 'Nearest replay state selection changed.'
    $point = ConvertTo-DriveOSMapPoint -State $nearest
    Assert-Equal $point.latitude 32.2 'Replay map projection changed.'

    $aliases = @(Update-DriveOSPlaceAliasEntries -Entries @() -Location '123 Test Street' -Label 'Home')
    $aliasMap = New-DriveOSPlaceAliasMap -Entries $aliases
    Assert-Equal (Resolve-DriveOSFriendlyLocation -Location '123 Test Street' -AliasMap $aliasMap) 'Home' 'Friendly location resolution changed.'
    $aliases = @(Update-DriveOSPlaceAliasEntries -Entries $aliases -Location '123 Test Street' -Label '')
    Assert-Equal $aliases.Count 0 'Friendly location removal changed.'

    $charge = [pscustomobject]@{id='charge-1';started_at=100;ended_at=3700;energy_added=10;cost=$null;location='123 Test Street';latitude=32;longitude=-97;is_supercharger=$false;odometer=1000;energy_used=11;miles_added=40;starting_battery=20;ending_battery=70}
    $chargeModel = ConvertTo-DriveOSCharge -Charge $charge -Settings ([pscustomobject]@{electricityRateCents=12.5}) -FriendlyLocation 'Home'
    Assert-Equal $chargeModel.durationMinutes 60 'Charge duration changed.'
    Assert-Equal $chargeModel.estimatedCost 1.4 'Fixed 14-cent home charging cost calculation changed.'
    Assert-Equal $chargeModel.location 'Home' 'Charge friendly location changed.'

    $recordedCharge = $charge.PSObject.Copy()
    $recordedCharge.cost = 2.75
    $recordedModel = ConvertTo-DriveOSCharge -Charge $recordedCharge -Settings $null -FriendlyLocation 'Home'
    Assert-Equal $recordedModel.displayCost 2.75 'Recorded Tessie charging cost must override the estimate.'
    Assert-Equal $recordedModel.costType 'recorded' 'Recorded Tessie charging cost type changed.'

    $supercharger = $charge.PSObject.Copy()
    $supercharger.is_supercharger = $true
    $superchargerModel = ConvertTo-DriveOSCharge -Charge $supercharger -Settings $null -FriendlyLocation 'Supercharger'
    Assert-Equal $superchargerModel.estimatedCost $null 'Supercharger cost must remain unknown when Tessie has no recorded cost.'
    Assert-Equal $superchargerModel.costType 'unknown' 'Supercharger unknown-cost type changed.'

    $history = @(
        [pscustomobject]@{id='track123456|a';track_id='track123456';track='Song';artist='Artist';played_at='2026-01-15T12:00:00Z';album_image='image';spotify_url='url'},
        [pscustomobject]@{id='track123456|b';track_id='track123456';track='Song';artist='Artist';played_at='2026-01-15T13:00:00Z';album_image='image';spotify_url='url'}
    )
    $musicStats = New-DriveOSMusicStats -History $history -Today ([datetime]'2026-01-15')
    Assert-Equal $musicStats.totalPlays 2 'Music total changed.'
    Assert-Equal $musicStats.topTracks[0].plays 2 'Top-track grouping changed.'
    Assert-Equal $musicStats.daily[-1].count 2 'Daily music grouping changed.'
    $driveStats = New-DriveOSDriveStats -Drives @([pscustomobject]@{miles=10;energyKWh=2.5;batteryUsed=5;songCount=3})
    Assert-Equal $driveStats.averageWhMi 250 'Drive efficiency changed.'
    $rawDrive=[pscustomobject]@{started_at=100;ended_at=3700;starting_battery=80;ending_battery=70;odometer_distance=10;energy_used=2.5;starting_location='A';ending_location='B';starting_latitude=32;starting_longitude=-97;ending_latitude=33;ending_longitude=-98;tag='Test';driver_profile='Driver';average_speed=30;max_speed=60}
    $driveModel=ConvertTo-DriveOSDrive -Drive $rawDrive -Soundtrack @([pscustomobject]@{track='Song'}) -StartingLocation Home -EndingLocation Work
    Assert-Equal $driveModel.durationMinutes 60 'Drive duration changed.'
    Assert-Equal $driveModel.efficiencyWhMi 250 'Drive efficiency mapping changed.'
    Assert-Equal $driveModel.songCount 1 'Drive soundtrack count changed.'
    $privateDrive=[pscustomobject]@{
        id='100-3700';startedAt='2026-08-08T22:00:00-05:00';dateLabel='Saturday, August 8'
        startingLocation='Home';endingLocation='IHOP'
        rawStartingLocation='SECRET HOME STREET, Saginaw, Texas 76179, United States'
        rawEndingLocation='100 Restaurant Way, Arlington, Texas 76011, United States'
        startingLatitude=32.812345;startingLongitude=-97.456789;endingLatitude=32.735;endingLongitude=-97.108
        miles=18.4;durationMinutes=42;efficiencyWhMi=241
        soundtrack=@([pscustomobject]@{track='Mr. Brightside';artist='The Killers';album='Hot Fuss';trackId='track123456';playedAt='2026-08-08T22:02:00-05:00'})
    }
    $shareCard=New-DriveOSShareCardModel -Drive $privateDrive
    Assert-Equal $shareCard.title 'Saturday Night Drive' 'Share card title changed.'
    Assert-Equal $shareCard.startLabel 'Saginaw, TX' 'Home share label must resolve to Saginaw.'
    Assert-Equal $shareCard.route.mode 'city-private' 'Home route must use private city geometry.'
    Assert-Equal $shareCard.privacy.homeProtected $true 'Home privacy flag changed.'
    Assert-Equal $shareCard.privacy.homeCoordinatesIncluded $false 'Share cards must not include Home coordinates.'
    $shareJson=$shareCard|ConvertTo-Json -Depth 8
    foreach($secret in @('SECRET HOME STREET','32.812345','-97.456789','rawStartingLocation')){
        if($shareJson -match [regex]::Escape($secret)){throw "Share card leaked protected data: $secret"}
    }
    Assert-Equal $shareCard.route.mapPoints[0].latitude 32.8601 'Private route must begin at the Saginaw city anchor.'
    Assert-Equal $shareCard.route.mapPoints[0].longitude -97.3639 'Private route must not begin at the Home longitude.'
    Assert-Equal $shareCard.route.songMarkers.Count 1 'Private share card must preserve numbered song moments.'
    Assert-Equal $shareCard.route.songMarkers[0].locationMode 'synthetic-progress' 'Home song markers must use synthetic route positions.'
    foreach($point in @($shareCard.route.points)){
        if($null -eq $point.x -or $null -eq $point.y -or $point.x -lt 0 -or $point.x -gt 1 -or $point.y -lt 0 -or $point.y -gt 1){throw 'Share route contains invalid normalized drawing points.'}
    }
    $publicDrive=$privateDrive.PSObject.Copy();$publicDrive.startingLocation='Coffee Shop';$publicDrive.rawStartingLocation='100 Coffee Way, Fort Worth, Texas 76102'
    $publicMap=[pscustomobject]@{
        routePoints=@([pscustomobject]@{latitude=32.75;longitude=-97.33},[pscustomobject]@{latitude=32.76;longitude=-97.31})
        songMarkers=@([pscustomobject]@{index=1;latitude=32.755;longitude=-97.32})
    }
    $publicCard=New-DriveOSShareCardModel -Drive $publicDrive -MapData $publicMap
    Assert-Equal $publicCard.route.mode 'recorded-simplified' 'Non-Home share card must use its recorded route.'
    Assert-Equal $publicCard.route.mapPoints[0].latitude 32.75 'Non-Home share route latitude changed.'
    Assert-Equal $publicCard.route.songMarkers[0].locationMode 'recorded' 'Public share cards must retain recorded song positions.'
    $recapDrive=[pscustomobject]@{startedAt='2026-01-10T12:00:00-06:00';miles=10;energyKWh=2.5;batteryUsed=5;songCount=1;startingLocation='Home';endingLocation='Work';shortDateLabel='Sat, Jan 10';soundtrack=@([pscustomobject]@{track='Song';artist='Artist'})}
    $recapCharge=[pscustomobject]@{startedAt='2026-01-11T12:00:00-06:00';energyAddedKWh=20;displayCost=3.5}
    $recaps=New-DriveOSMonthlyRecaps -Drives @($recapDrive) -Charges @($recapCharge) -Settings ([pscustomobject]@{electricityRateCents=12.5}) -Now ([datetime]'2026-01-20')
    Assert-Equal $recaps.recaps[0].driveCount 1 'Monthly drive count changed.'
    Assert-Equal $recaps.recaps[0].topTrack 'Song' 'Monthly top track changed.'
    Assert-Equal $recaps.recaps[0].chargingCost 3.5 'Monthly charging cost changed.'
    $plan=New-DriveOSPlaylistPlan -Drive ([pscustomobject]@{shortDateLabel='Jan 1';startTime='8:00 AM';soundtrack=@([pscustomobject]@{trackUri='spotify:track:one'},[pscustomobject]@{trackUri='spotify:track:one'},[pscustomobject]@{trackUri='spotify:track:two'})})
    Assert-Equal $plan.uris.Count 2 'Playlist URI de-duplication changed.'
    Assert-Equal $plan.name 'DriveOS - Jan 1 8:00 AM' 'Playlist naming changed.'
    $requestBody=ConvertFrom-DriveOSRequestBody -BodyText '{"driveId":"drive-1"}' -RequiredFields driveId
    Assert-Equal $requestBody.driveId 'drive-1' 'HTTP body parsing changed.'
    $httpError=Get-DriveOSHttpError -Message 'driveId is required.'
    Assert-Equal $httpError.statusCode 400 'HTTP validation status changed.'
    $httpError=Get-DriveOSHttpError -Message 'unexpected private failure'
    Assert-Equal $httpError.publicMessage 'DriveOS request failed.' 'HTTP error redaction changed.'

    $server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
    $contracts = Get-Content (Join-Path $PSScriptRoot 'fixtures\endpoint-contracts.json') -Raw | ConvertFrom-Json
    foreach ($contract in $contracts) {
        $needle = if ($contract.path) { [regex]::Escape([string]$contract.path) } else { [regex]::Escape([string]$contract.pathPattern) }
        if ($server -notmatch $needle) { throw "Endpoint contract disappeared: $($contract.method) $($contract.path)$($contract.pathPattern)" }
    }
    Write-Host 'Phase 2 repository, domain, and endpoint characterization tests passed.'
}
finally {
    if (Test-Path -LiteralPath $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
}
