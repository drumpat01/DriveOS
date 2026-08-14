$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $Root 'src\Application\DriveOS.TessieReadiness.psm1') -Force

function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { throw $Message } }

$Now = [DateTimeOffset]::Parse('2026-08-14T15:00:00Z')
$CursorReader = {
    param($Repository,$Resource)
    [PSCustomObject]@{
        cursor_value='1770000000'
        high_watermark_utc=$Now.AddMinutes(-10).ToString('o')
        last_success_at_utc=$Now.AddMinutes(-9).ToString('o')
        last_error=$null
    }
}
$Result = Assert-JourneyDeckTessieReadReady -Repository ([PSCustomObject]@{}) -Now $Now -CursorReader $CursorReader
Assert-True ($Result.ready -and @($Result.resources).Count -eq 2) 'Fresh independent cursors should permit database reads.'

$StaleRejected = $false
try {
    $null = Assert-JourneyDeckTessieReadReady -Repository ([PSCustomObject]@{}) -Now $Now -CursorReader {
        param($Repository,$Resource)
        [PSCustomObject]@{ cursor_value='1'; high_watermark_utc=$Now.AddHours(-2).ToString('o'); last_success_at_utc=$Now.AddHours(-2).ToString('o'); last_error=$null }
    }
}
catch { $StaleRejected = $_.Exception.Message -match 'within 45 minutes' }
Assert-True $StaleRejected 'Stale Tessie cursors must block database read activation.'

$ErrorRejected = $false
try {
    $null = Assert-JourneyDeckTessieReadReady -Repository ([PSCustomObject]@{}) -Now $Now -CursorReader {
        param($Repository,$Resource)
        [PSCustomObject]@{ cursor_value='1'; high_watermark_utc=$Now.ToString('o'); last_success_at_utc=$Now.ToString('o'); last_error='provider timeout' }
    }
}
catch { $ErrorRejected = $_.Exception.Message -match 'cursor error' }
Assert-True $ErrorRejected 'A current cursor error must block database read activation.'

$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
Assert-True ($Server -match 'DB_READ_ENABLED requires JOURNEYDECK_TESSIE_DB_WRITE_ENABLED=true') 'Read activation does not require the external worker flag.'
Assert-True ($Server -match 'Assert-JourneyDeckTessieReadReady') 'Server startup does not enforce cursor freshness.'

Write-Host 'JourneyDeck Tessie read-readiness checks passed.' -ForegroundColor Green
