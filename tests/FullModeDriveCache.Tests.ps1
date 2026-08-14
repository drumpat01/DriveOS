$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw

Assert-True ($server -match 'Get-CanonicalDriveSoundtrack') 'Full Mode is not using the shared soundtrack cache.'
Assert-True ($server -match 'Get-DriveOSDriveSoundtracks -Repository \$Repository') 'Shared soundtrack records are not loaded through the repository.'
Assert-True ($server -match 'Set-DriveOSDriveSoundtrack -Repository \$Repository') 'Shared soundtrack records are not persisted through the repository.'
Assert-True ($server -match 'DriveSoundtrackRecordsLoaded') 'Shared soundtrack cache lacks its process-local read-through layer.'
Assert-True ($server -match 'AddHours\(-3\)') 'New drives do not retain a Spotify catch-up window.'
Assert-True ($server -match 'Update-RecentDriveSoundtrackCache -Days 1') 'Scheduled sync does not reconcile the previous day of drives.'
Assert-True ($server -notmatch 'full-mode-drive-cache') 'The legacy Full Mode-only soundtrack cache is still active.'

$recentFunction = [regex]::Match(
    $server,
    '(?s)function Get-RecentDrives\s*\{.*?(?=\r?\nfunction Get-CachedRecentDrives365)'
).Value
Assert-True ($recentFunction -match 'Get-SpotifyHistory') 'Full Mode does not provide shared Spotify history to the canonical cache.'
Assert-True ($recentFunction -match 'Convert-RawDrive') 'Full Mode no longer builds drive records.'

$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseInput(
    $server,
    [ref]$tokens,
    [ref]$parseErrors
)
Assert-True ($parseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'

Write-Host 'Full Mode durable drive cache checks passed.' -ForegroundColor Green
