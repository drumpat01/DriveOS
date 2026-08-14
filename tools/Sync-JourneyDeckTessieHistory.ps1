param(
    [ValidateRange(0,365)][int]$InitialDays = 0,
    [ValidateRange(1,300)][int]$TessieTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($env:TURSO_DATABASE_URL)) { throw 'TURSO_DATABASE_URL is required.' }
if ([string]::IsNullOrWhiteSpace($env:TURSO_AUTH_TOKEN)) { throw 'TURSO_AUTH_TOKEN is required.' }
if ([string]::IsNullOrWhiteSpace($env:TESSIE_TOKEN)) { throw 'TESSIE_TOKEN is required.' }
if ("$($env:JOURNEYDECK_TESSIE_DB_WRITE_ENABLED)".Trim().ToLowerInvariant() -notin @('1','true','yes','on')) {
    throw 'JOURNEYDECK_TESSIE_DB_WRITE_ENABLED must be true for the worker.'
}
if ($InitialDays -eq 0) {
    $InitialDays = 30
    if ($env:JOURNEYDECK_TESSIE_INITIAL_SYNC_DAYS -and (
        -not [int]::TryParse("$($env:JOURNEYDECK_TESSIE_INITIAL_SYNC_DAYS)",[ref]$InitialDays) -or
        $InitialDays -lt 1 -or
        $InitialDays -gt 365
    )) {
        throw 'JOURNEYDECK_TESSIE_INITIAL_SYNC_DAYS must be between 1 and 365.'
    }
}

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Integrations\Tessie\DriveOS.Tessie.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieSync.psm1') -Force

$DataDirectory = if ($env:DRIVEOS_DATA_DIR) { $env:DRIVEOS_DATA_DIR } else { Join-Path ([IO.Path]::GetTempPath()) 'journeydeck-worker' }
$Repository = New-DriveOSRepository -DataDirectory $DataDirectory -AppRoot $Root -Provider Turso
Initialize-DriveOSTurso -Repository $Repository
$Client = New-TessieClient -Token $env:TESSIE_TOKEN -TimeoutSeconds $TessieTimeoutSeconds
$Result = Invoke-JourneyDeckTessieHistorySync -Repository $Repository -Client $Client -InitialDays $InitialDays
$Result | ConvertTo-Json -Depth 5
