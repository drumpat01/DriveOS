$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw

Assert-True ($server -match '\$FullModeDriveCacheFile') 'Full Mode durable drive cache file is missing.'
Assert-True ($server -match 'Get-DriveOSTursoState -Repository \$Repository -Key "full-mode-drive-cache"') 'Full Mode cache is not read from Turso.'
Assert-True ($server -match 'Set-DriveOSTursoState -Repository \$Repository -Key "full-mode-drive-cache"') 'Full Mode cache is not persisted to Turso.'
Assert-True ($server -match 'FullModeDriveRecordsLoaded') 'Full Mode cache lacks its process-local read-through layer.'
Assert-True ($server -match 'FinalizationCutoff = \[DateTimeOffset\]::UtcNow.AddMinutes\(-15\)') 'Newly finished drives are finalized too early.'
Assert-True ($server -match 'UseSoundtrackOverride') 'Cached Full Mode soundtracks are not reused.'
Assert-True ($server -match 'Completed drives are immutable for soundtrack matching') 'Completed-drive permanence is not documented in code.'

$recentFunction = [regex]::Match(
    $server,
    '(?s)function Get-RecentDrives\s*\{.*?(?=\r?\nfunction Get-CachedRecentDrives365)'
).Value
Assert-True ($recentFunction -match '\$SpotifyHistory = \$null') 'Full Mode eagerly opens Spotify history before checking its cache.'
Assert-True ($recentFunction -match 'if \(\$null -eq \$SpotifyHistory\)') 'Full Mode does not lazily load Spotify history for uncached drives.'

$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseInput(
    $server,
    [ref]$tokens,
    [ref]$parseErrors
)
Assert-True ($parseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'

Write-Host 'Full Mode durable drive cache checks passed.' -ForegroundColor Green
