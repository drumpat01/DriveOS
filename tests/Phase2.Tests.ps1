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
Import-Module (Join-Path $Root 'src\Application\DriveOS.Playlists.psm1') -Force

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
    }else{Write-Warning 'SQLite runtime unavailable; SQLite provider tests skipped.'}

    $vehicle = Get-Content (Join-Path $PSScriptRoot 'fixtures\vehicle.json') -Raw | ConvertFrom-Json
    $summary = ConvertTo-DriveOSVehicleSummary -Vehicle $vehicle
    Assert-Equal $summary.name 'Test Vehicle' 'Vehicle name changed.'
    Assert-Equal $summary.rangeMiles 185 'Vehicle range rounding changed.'
    Assert-Equal $summary.insideTempF 68 'Vehicle temperature conversion changed.'

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
    Assert-Equal $chargeModel.estimatedCost 1.25 'Charge cost calculation changed.'
    Assert-Equal $chargeModel.location 'Home' 'Charge friendly location changed.'

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
    $plan=New-DriveOSPlaylistPlan -Drive ([pscustomobject]@{shortDateLabel='Jan 1';startTime='8:00 AM';soundtrack=@([pscustomobject]@{trackUri='spotify:track:one'},[pscustomobject]@{trackUri='spotify:track:one'},[pscustomobject]@{trackUri='spotify:track:two'})})
    Assert-Equal $plan.uris.Count 2 'Playlist URI de-duplication changed.'
    Assert-Equal $plan.name 'DriveOS - Jan 1 8:00 AM' 'Playlist naming changed.'

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
