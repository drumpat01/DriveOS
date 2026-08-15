$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

$server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
$auth = Get-Content (Join-Path $Root 'src\Security\DriveOS.WebAuth.psm1') -Raw
$wifeHtml = Get-Content (Join-Path $Root 'web\wife.html') -Raw
$wifeJs = Get-Content (Join-Path $Root 'web\wife.js') -Raw
$wifeMusicFunction = [regex]::Match($server, '(?s)function Get-WifeModeMusic\s*\{.*?(?=\r?\nfunction Get-WifeModeVehicle)').Value

Assert-True ($auth -match 'DRIVEOS_WIFE_USERNAME') 'Wife username configuration is missing.'
Assert-True ($auth -match 'DRIVEOS_WIFE_PASSWORD_HASH') 'Wife password configuration is missing.'
Assert-True ($server -match 'Get-WifeModeSummary') 'Wife summary endpoint is missing.'
Assert-True ($server -match '"/api/wife/mode"') 'Wife Mode switch endpoint is missing.'
Assert-True ($server -match '"/api/wife/music"') 'Deferred Wife Mode music endpoint is missing.'
Assert-True ($wifeMusicFunction -match 'Get-CachedDriveSoundtrack') 'Wife Mode is not using the shared drive soundtrack cache.'
Assert-True ($server -notmatch 'wife-mode-music') 'The legacy Wife Mode-only music cache is still active.'
Assert-True ($server -match 'Update-RecentDriveSoundtrackCache -Days 1') 'Delayed Spotify syncs cannot repair Wife Mode soundtracks.'
Assert-True ($wifeMusicFunction -notmatch 'Get-SoundtrackForWindow') 'Wife Mode bypasses the canonical soundtrack cache.'
Assert-True ($wifeMusicFunction -notmatch 'Get-SpotifyTrackMetadata') 'Wife Mode still performs unnecessary Spotify metadata requests.'
Assert-True ($wifeMusicFunction -notmatch 'Get-SpotifyHistory|Get-CanonicalDriveSoundtrack|Save-DriveSoundtrackRecord') 'Wife Mode can still load, reconcile, or write soundtrack history.'
Assert-True ($server -match 'Get-WifeModeBaseDrives[\s\S]+Convert-RawDrive[^\r\n]+-SkipSoundtrack') 'Wife Mode core drive loading can write a false empty soundtrack.'
Assert-True ($wifeHtml -match 'Open Full JourneyDeck') 'Full JourneyDeck toggle is missing.'
Assert-True ($wifeHtml -notmatch '(?i)charging|notification|data health') 'Wife screen includes an excluded control.'
Assert-True ($wifeHtml -match 'id="wifeSignOut"') 'Wife Mode mobile sign-out is missing.'
Assert-True ($wifeJs -match '/api/auth/logout') 'Wife Mode sign-out does not clear the hosted session.'
Assert-True ($wifeHtml -match 'tripDetailView') 'Wife Mode read-only drive overview is missing.'
Assert-True ($wifeHtml -match 'WIFE MODE.*DRIVE OVERVIEW') 'Wife Mode detail branding is missing.'
Assert-True ($wifeHtml -notmatch '(?i)shareCardButton|playlistButton|place-name-edit') 'Wife Mode exposes an owner drive action.'
Assert-True ($wifeHtml -match 'wifeDriveMap') 'Wife Mode drive map is missing.'
Assert-True ($wifeHtml -match 'wifeDetailMusic') 'Wife Mode soundtrack list is missing.'
Assert-True ($wifeJs -match '/api/wife/vehicle') 'Wife dashboard does not request its vehicle summary.'
Assert-True ($wifeJs -match '/api/wife/drives') 'Wife dashboard does not request its curated drives.'
Assert-True ($wifeJs -match 'Music loading') 'Wife dashboard does not show deferred music progress.'
Assert-True ($wifeJs -match 'void request\("/api/wife/music"\)') 'Wife dashboard blocks core data on Spotify enrichment.'
Assert-True ($wifeJs -match '/api/wife/drive/map') 'Wife Mode does not request its read-only map data.'
Assert-True ($wifeJs -match '/api/wife/mode') 'Wife dashboard cannot switch to full mode.'
Assert-True ($wifeJs -match 'data-wife-drive-id') 'Wife Mode recent drives are not interactive.'
Assert-True ($wifeJs -notmatch 'detailMetric\("(Battery used|Energy|Efficiency)"') 'Wife Mode exposes a hidden drive metric.'
Assert-True ($server -match '"/api/wife/drive/map"') 'Wife Mode read-only map endpoint is missing.'
Assert-True ($server -match '\$WifePostAllowed\s*=\s*\$Method -eq "POST" -and \$Path -in @\("/api/wife/mode", "/api/wife/drive/map", "/api/auth/logout"\)') 'Wife Mode map or sign-out POST is blocked by the production authorization guard.'
Assert-True ($server -match '\$Method -eq "POST" -and -not \$IsPublicWebRequest -and -not \$WifePostAllowed') 'A Wife Mode cookie can still block the public login API.'

$tokens = $null
$parseErrors = $null
$serverAst = [System.Management.Automation.Language.Parser]::ParseInput($server, [ref]$tokens, [ref]$parseErrors)
Assert-True ($parseErrors.Count -eq 0) 'DriveOS server has PowerShell syntax errors.'
$todayFunction = $serverAst.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-WifeModeToday'
}, $true)
Assert-True ($null -ne $todayFunction) 'Wife Mode today calculation is missing.'
Invoke-Expression $todayFunction.Extent.Text

$todayIso = [DateTimeOffset]::Now.ToString('yyyy-MM-dd')
$todayResult = Get-WifeModeToday -Drives @([ordered]@{ dateIso = $todayIso; miles = 24.8 })
$emptyResult = Get-WifeModeToday -Drives @()
Assert-True ($todayResult.miles -eq 24.8 -and $todayResult.trips -eq 1) 'Wife Mode does not total today''s drives.'
Assert-True ($emptyResult.miles -eq 0 -and $emptyResult.trips -eq 0) 'Wife Mode fails when today has no drives.'
Write-Host 'Wife Mode checks passed.' -ForegroundColor Green
