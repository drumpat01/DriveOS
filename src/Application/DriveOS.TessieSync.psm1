Set-StrictMode -Version 2.0

function Invoke-JourneyDeckTessieHistorySync {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Client,
        [AllowNull()]$Vehicle,
        [ValidateRange(1,365)][int]$InitialDays = 30,
        [ValidateRange(0,86400)][int]$OverlapSeconds = 21600,
        [DateTimeOffset]$RangeToUtc = [DateTimeOffset]::UtcNow,
        [scriptblock]$HistoryReader
    )

    if (-not $Vehicle) { $Vehicle = Get-TessieVehicle -Client $Client }
    if (-not $Vehicle -or -not $Vehicle.vin) { throw 'No Tessie vehicle found for history sync.' }

    $To = $RangeToUtc.ToUniversalTime()
    $ToEpoch = $To.ToUnixTimeSeconds()
    $Counts = @{ drives=0; charges=0 }
    $Failures = @()
    if (-not $HistoryReader) {
        $HistoryReader = {
            param($ReaderClient,$Vin,$Resource,$FromEpoch,$ToEpoch,$ExtraQuery)
            Get-TessieCompleteHistoryRange -Client $ReaderClient -Vin $Vin -Resource $Resource -From $FromEpoch -To $ToEpoch -ExtraQuery $ExtraQuery -Limit 1000
        }
    }
    $Specifications = @(
        [PSCustomObject]@{ Resource='drives'; ExtraQuery='distance_format=mi&temperature_format=f' },
        [PSCustomObject]@{ Resource='charges'; ExtraQuery='distance_format=mi' }
    )

    foreach ($Specification in $Specifications) {
        $Resource = $Specification.Resource
        $FromEpoch = $To.AddDays(-$InitialDays).ToUnixTimeSeconds()
        $Cursor = Get-DriveOSIntegrationSyncCursor -Repository $Repository -Provider 'tessie' -Resource $Resource
        if ($Cursor -and $Cursor.cursor_value) {
            $CursorEpoch = 0L
            if ([long]::TryParse("$($Cursor.cursor_value)",[ref]$CursorEpoch) -and $CursorEpoch -gt 0) {
                $FromEpoch = [math]::Max(0,$CursorEpoch - $OverlapSeconds)
            }
        }

        $From = [DateTimeOffset]::FromUnixTimeSeconds($FromEpoch)
        $Run = New-DriveOSIntegrationSyncRun -Provider 'tessie' -Resource $Resource -RangeFromUtc $From -RangeToUtc $To
        try {
            Set-DriveOSIntegrationSyncRun -Repository $Repository -Run $Run
            $Response = & $HistoryReader $Client $Vehicle.vin $Resource $FromEpoch $ToEpoch $Specification.ExtraQuery
            $Records = @($Response.results)
            $Run.status = 'succeeded'
            $Run.recordsSeen = $Records.Count
            $Run.recordsWritten = $Records.Count
            $Run.completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')

            if ($Resource -eq 'drives') {
                $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Drives $Records -RangeToUtc $To -CompletedResources @('drives') -SyncRun $Run
            }
            else {
                $null = Save-DriveOSTessieHistorySnapshot -Repository $Repository -Vehicle $Vehicle -Charges $Records -RangeToUtc $To -CompletedResources @('charges') -SyncRun $Run
            }
            $Counts[$Resource] = $Records.Count
        }
        catch {
            $Message = "$($_.Exception.Message)"
            if ($Message.Length -gt 2000) { $Message = $Message.Substring(0,2000) }
            $Run.status = 'failed'
            $Run.completedAtUtc = [DateTimeOffset]::UtcNow.ToString('o')
            $Run.errorMessage = $Message
            try { Set-DriveOSIntegrationSyncRun -Repository $Repository -Run $Run } catch {}
            $Failures += "$Resource`: $Message"
        }
    }

    if ($Failures.Count) { throw "Tessie history sync was incomplete: $($Failures -join '; ')" }
    return [PSCustomObject]@{
        ok = $true
        drives = $Counts.drives
        charges = $Counts.charges
        completedAt = [DateTimeOffset]::UtcNow.ToString('o')
    }
}

Export-ModuleMember -Function Invoke-JourneyDeckTessieHistorySync
