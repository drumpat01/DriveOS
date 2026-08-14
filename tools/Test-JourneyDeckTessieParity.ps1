param(
    [ValidateSet(30)][int]$Days = 30,
    [ValidateRange(1,1440)][int]$MaximumCursorLagMinutes = 45,
    [string]$OutputPath,
    [switch]$RequireReady
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

Import-Module (Join-Path $Root 'src\Configuration\DriveOS.Configuration.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Integrations\Tessie\DriveOS.Tessie.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Drives\DriveOS.Drives.psm1') -Force
Import-Module (Join-Path $Root 'src\Domain\Charging\DriveOS.Charging.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieParity.psm1') -Force

$Runtime = Get-DriveOSRuntimeConfiguration -AppRoot $Root
$Repository = New-DriveOSRepository -DataDirectory $Runtime.DataDirectory -AppRoot $Root
if ($Repository.Provider -notin @('SQLite','Turso')) {
    throw 'The Tessie parity audit requires the SQLite or Turso repository provider.'
}
if (-not $OutputPath) { $OutputPath = Join-Path $Runtime.DataDirectory 'journeydeck-tessie-parity.json' }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
$GeneratedAt = [DateTimeOffset]::UtcNow
$DriveCursor = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource drives
$ChargeCursor = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider tessie -Resource charges

$CursorEpochs = @()
foreach ($Cursor in @($DriveCursor,$ChargeCursor)) {
    $Epoch = 0L
    if ($Cursor -and [long]::TryParse("$($Cursor.cursor_value)",[ref]$Epoch) -and $Epoch -gt 0) { $CursorEpochs += $Epoch }
}

if ($CursorEpochs.Count -ne 2) {
    $RangeTo = $GeneratedAt
    $RangeFrom = $RangeTo.AddDays(-$Days)
    $Report = New-JourneyDeckTessieParityReport -RepositoryProvider $Repository.Provider -Vin 'unavailable' -DriveCursor $DriveCursor -ChargeCursor $ChargeCursor -RangeFromUtc $RangeFrom -RangeToUtc $RangeTo -GeneratedAtUtc $GeneratedAt -MaximumCursorLagMinutes $MaximumCursorLagMinutes
}
else {
    $RangeToEpoch = [long](($CursorEpochs | Measure-Object -Minimum).Minimum)
    $RangeTo = [DateTimeOffset]::FromUnixTimeSeconds($RangeToEpoch)
    $RangeFrom = $RangeTo.AddDays(-$Days)
    if ([String]::IsNullOrWhiteSpace("$($env:TESSIE_TOKEN)")) { throw 'TESSIE_TOKEN is required for the provider side of the parity audit.' }
    $Client = New-TessieClient -Token $env:TESSIE_TOKEN
    $Vehicle = Get-TessieVehicle -Client $Client
    if (-not $Vehicle -or -not $Vehicle.vin) { throw 'No Tessie vehicle was available for the parity audit.' }
    $FromEpoch = $RangeFrom.ToUnixTimeSeconds()
    $ProviderDrives = Get-TessieCompleteHistoryRange -Client $Client -Vin $Vehicle.vin -Resource drives -From $FromEpoch -To $RangeToEpoch -ExtraQuery 'distance_format=mi&temperature_format=f' -Limit 1000
    $ProviderCharges = Get-TessieCompleteHistoryRange -Client $Client -Vin $Vehicle.vin -Resource charges -From $FromEpoch -To $RangeToEpoch -ExtraQuery 'distance_format=mi' -Limit 1000
    $VehicleId = New-DriveOSStableDataId -Entity vehicle -ProviderKey "tessie:$($Vehicle.vin)"
    $DatabaseDrives = @(Get-DriveOSTessieAuditRows -Repository $Repository -Resource drives -FromEpoch $FromEpoch -ToEpoch $RangeToEpoch -VehicleId $VehicleId)
    $DatabaseCharges = @(Get-DriveOSTessieAuditRows -Repository $Repository -Resource charges -FromEpoch $FromEpoch -ToEpoch $RangeToEpoch -VehicleId $VehicleId)
    $Report = New-JourneyDeckTessieParityReport `
        -RepositoryProvider $Repository.Provider `
        -Vin $Vehicle.vin `
        -ProviderDrives @($ProviderDrives.results) `
        -DatabaseDrives $DatabaseDrives `
        -ProviderCharges @($ProviderCharges.results) `
        -DatabaseCharges $DatabaseCharges `
        -DriveCursor $DriveCursor `
        -ChargeCursor $ChargeCursor `
        -RangeFromUtc $RangeFrom `
        -RangeToUtc $RangeTo `
        -GeneratedAtUtc $GeneratedAt `
        -MaximumCursorLagMinutes $MaximumCursorLagMinutes
}

Write-DriveOSJson -Path $OutputPath -Value $Report
Write-Host "JourneyDeck Tessie parity status: $($Report.status)" -ForegroundColor $(if($Report.readyForReadCanary){'Green'}else{'Yellow'})
Write-Host "Report: $OutputPath"
if ($RequireReady -and -not $Report.readyForReadCanary) { throw "Tessie parity audit is $($Report.status); database reads must remain disabled." }
return $Report
