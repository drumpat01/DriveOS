$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root 'src\Integrations\Tessie\DriveOS.Tessie.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieSync.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieReadiness.psm1') -Force

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }
function Assert-Equal { param($Actual,$Expected,[string]$Message) if ($Actual -ne $Expected) { throw "$Message Expected '$Expected', got '$Actual'." } }

$global:JourneyDeckTessieRequests = New-Object System.Collections.ArrayList
try {
    $Request = {
        param($Client,$Vin,$Resource,$From,$To,$ExtraQuery)
        $null = $global:JourneyDeckTessieRequests.Add([PSCustomObject]@{ From=$From; To=$To; ExtraQuery=$ExtraQuery })
        if ($From -eq 1000 -and $To -eq 1100) {
            return [PSCustomObject]@{ results=@(
                [PSCustomObject]@{ id=1; started_at=1001; ended_at=1002 },
                [PSCustomObject]@{ id=2; started_at=1090; ended_at=1091 }
            ) }
        }
        if ($To -le 1050) { return [PSCustomObject]@{ results=@([PSCustomObject]@{ id=1; started_at=1001; ended_at=1002 }) } }
        return [PSCustomObject]@{ results=@([PSCustomObject]@{ id=2; started_at=1090; ended_at=1091 }) }
    }
    $Complete = Get-TessieCompleteHistoryRange -Client ([PSCustomObject]@{}) -Vin 'VIN' -Resource drives -From 1000 -To 1100 -Limit 2 -MinimumWindowSeconds 5 -Request $Request
    Assert-Equal $Complete.requestCount 3 'A saturated Tessie window was not split exactly once.'
    Assert-Equal $Complete.acceptedWindowCount 2 'Split Tessie windows were not both accepted.'
    Assert-Equal @($Complete.results).Count 2 'Split Tessie results were not combined without loss.'
    Assert-True ($global:JourneyDeckTessieRequests[0].ExtraQuery -match '(^|&)limit=2(&|$)') 'The provider result limit was not included in bounded requests.'

    $AlwaysSaturated = {
        param($Client,$Vin,$Resource,$From,$To,$ExtraQuery)
        [PSCustomObject]@{ results=@(
            [PSCustomObject]@{ id=1; started_at=$From; ended_at=$From },
            [PSCustomObject]@{ id=2; started_at=$To; ended_at=$To }
        ) }
    }
    $Rejected = $false
    try {
        $null = Get-TessieCompleteHistoryRange -Client ([PSCustomObject]@{}) -Vin 'VIN' -Resource charges -From 1000 -To 1010 -Limit 2 -MinimumWindowSeconds 5 -Request $AlwaysSaturated
    }
    catch { $Rejected = $_.Exception.Message -match 'cursor was not advanced' }
    Assert-True $Rejected 'An irreducibly saturated Tessie window must fail before cursor advancement.'
}
finally {
    Remove-Variable JourneyDeckTessieRequests -Scope Global -ErrorAction SilentlyContinue
}

$ClientWithTimeout = New-TessieClient -Token 'test-token' -TimeoutSeconds 17
Assert-Equal $ClientWithTimeout.TimeoutSeconds 17 'Tessie client timeout was not retained.'

$SqliteExecutable = Join-Path $Root 'tools\sqlite\sqlite3.exe'
if (Test-Path -LiteralPath $SqliteExecutable) {
    $Scratch = Join-Path ([IO.Path]::GetTempPath()) ('journeydeck-worker-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $Scratch | Out-Null
    try {
        $Repository = New-DriveOSRepository -DataDirectory $Scratch -AppRoot $Root -Provider SQLite
        Initialize-DriveOSSqlite -Repository $Repository
        $RangeTo = [DateTimeOffset]::UtcNow
        $Started = $RangeTo.AddHours(-2).ToUnixTimeSeconds()
        $Ended = $RangeTo.AddHours(-1).ToUnixTimeSeconds()
        $WorkerVehicle = [PSCustomObject]@{ vin='WORKERVIN000000001'; last_state=[PSCustomObject]@{ display_name='Worker Test' } }
        $HistoryReader = {
            param($Client,$Vin,$Resource,$From,$To,$ExtraQuery)
            if ($Resource -eq 'drives') {
                return [PSCustomObject]@{ results=@([PSCustomObject]@{ id='worker-drive'; started_at=$Started; ended_at=$Ended; odometer_distance=5 }) }
            }
            return [PSCustomObject]@{ results=@([PSCustomObject]@{ id='worker-charge'; started_at=$Started; ended_at=$Ended; energy_added=10 }) }
        }
        $WorkerResult = Invoke-JourneyDeckTessieHistorySync -Repository $Repository -Client ([PSCustomObject]@{}) -Vehicle $WorkerVehicle -RangeToUtc $RangeTo -HistoryReader $HistoryReader
        Assert-Equal $WorkerResult.drives 1 'External worker did not ingest the drive resource.'
        Assert-Equal $WorkerResult.charges 1 'External worker did not ingest the charging resource.'
        Assert-True ((Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource drives).cursor_value -eq $RangeTo.ToUnixTimeSeconds()) 'External worker did not advance the drive cursor.'
        Assert-True ((Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource charges).cursor_value -eq $RangeTo.ToUnixTimeSeconds()) 'External worker did not advance the charging cursor.'
        Assert-True ((Assert-JourneyDeckTessieReadReady -Repository $Repository -Now $RangeTo).ready) 'Fresh worker cursors did not activate the default read-readiness path.'
    }
    finally {
        if (Test-Path -LiteralPath $Scratch) { Remove-Item -LiteralPath $Scratch -Recurse -Force }
    }
}

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
Assert-True (-not ($Server -match '/api/tessie/sync')) 'Tessie ingestion is still exposed through the single-threaded web server.'
$Worker = Get-Content (Join-Path $Root 'tools\Sync-JourneyDeckTessieHistory.ps1') -Raw
Assert-True ($Worker -match 'Invoke-JourneyDeckTessieHistorySync') 'The direct Tessie worker entry point is missing.'

$Workflow = Get-Content (Join-Path $Root '.github\workflows\tessie-history-sync.yml') -Raw
Assert-True ($Workflow -match '7,22,37,52 \* \* \* \*') 'Tessie workflow is not staggered from the Spotify schedule.'
Assert-True ($Workflow -match 'Sync-JourneyDeckTessieHistory\.ps1') 'Tessie workflow does not execute the direct worker.'
Assert-True ($Workflow -match "if:\s*vars\.JOURNEYDECK_TESSIE_DB_WRITE_ENABLED == 'true'") 'Tessie workflow is not disabled by default behind its rollout variable.'
Assert-True ($Workflow -match 'TURSO_DATABASE_URL' -and $Workflow -match 'TURSO_AUTH_TOKEN' -and $Workflow -match 'TESSIE_TOKEN') 'Tessie workflow is missing direct worker credentials.'
Assert-True (-not ($Workflow -match 'DRIVEOS_SYNC_URL|X-DriveOS-Sync-Token|/api/tessie/sync')) 'Tessie workflow still routes ingestion through the web process.'

Write-Host 'JourneyDeck Tessie ingestion checks passed.' -ForegroundColor Green
