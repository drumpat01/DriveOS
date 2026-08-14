Set-StrictMode -Version 2.0

function Assert-JourneyDeckTessieReadReady {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [ValidateRange(5,1440)][int]$MaximumStalenessMinutes = 45,
        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow,
        [scriptblock]$CursorReader
    )

    if (-not $CursorReader) {
        $CursorReader = {
            param($TargetRepository,$Resource)
            Get-DriveOSIntegrationSyncCursor -Repository $TargetRepository -Provider 'tessie' -Resource $Resource
        }
    }

    $Checked = @()
    foreach ($Resource in @('drives','charges')) {
        $Cursor = & $CursorReader $Repository $Resource
        if (-not $Cursor -or -not $Cursor.cursor_value -or -not $Cursor.high_watermark_utc -or -not $Cursor.last_success_at_utc) {
            throw "JourneyDeck database reads require a completed Tessie $Resource cursor."
        }
        if ($Cursor.last_error) { throw "JourneyDeck database reads are blocked by the Tessie $Resource cursor error." }

        $LastSuccess = [DateTimeOffset]::MinValue
        $HighWatermark = [DateTimeOffset]::MinValue
        if (-not [DateTimeOffset]::TryParse("$($Cursor.last_success_at_utc)",[ref]$LastSuccess)) {
            throw "The Tessie $Resource last-success timestamp is invalid."
        }
        if (-not [DateTimeOffset]::TryParse("$($Cursor.high_watermark_utc)",[ref]$HighWatermark)) {
            throw "The Tessie $Resource high-watermark timestamp is invalid."
        }
        if ($LastSuccess.ToUniversalTime() -gt $Now.ToUniversalTime().AddMinutes(5)) {
            throw "The Tessie $Resource last-success timestamp is in the future."
        }
        if (($Now.ToUniversalTime() - $LastSuccess.ToUniversalTime()).TotalMinutes -gt $MaximumStalenessMinutes) {
            throw "JourneyDeck database reads require a Tessie $Resource success within $MaximumStalenessMinutes minutes."
        }
        if (($Now.ToUniversalTime() - $HighWatermark.ToUniversalTime()).TotalMinutes -gt $MaximumStalenessMinutes) {
            throw "JourneyDeck database reads require a Tessie $Resource high watermark within $MaximumStalenessMinutes minutes."
        }
        $Checked += $Resource
    }

    return [PSCustomObject]@{ ready=$true; resources=$Checked; checkedAtUtc=$Now.ToUniversalTime().ToString('o') }
}

Export-ModuleMember -Function Assert-JourneyDeckTessieReadReady
