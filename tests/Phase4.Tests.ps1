$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$DesktopFiles = @(Get-ChildItem (Join-Path $Root 'desktop') -Filter '*.cs' -File)
Assert-True ($DesktopFiles.Name -contains 'DriveOSBackendHost.cs') 'Desktop backend lifecycle boundary is missing.'
Assert-True ($DesktopFiles.Name -contains 'DriveOSSecurityPolicy.cs') 'Desktop security policy boundary is missing.'

$Policy = Get-Content (Join-Path $Root 'desktop\DriveOSSecurityPolicy.cs') -Raw
Assert-True ($Policy -match 'RandomNumberGenerator') 'Session tokens must use a cryptographic RNG.'
Assert-True ($Policy -match 'AreDevToolsEnabled = false') 'Embedded browser developer tools must remain disabled.'
Assert-True ($Policy -match 'CoreWebView2PermissionState.Deny' -or
    (Get-Content (Join-Path $Root 'desktop\Program.cs') -Raw) -match 'CoreWebView2PermissionState.Deny') 'Browser permissions must remain denied.'

$ShortcutModule = Get-Content (Join-Path $Root 'src\Application\DriveOS.Shortcuts.psm1') -Raw
$Server = Get-Content (Join-Path $Root 'DriveOS-Server.ps1') -Raw
Assert-True ($ShortcutModule -match 'RandomNumberGenerator') 'Siri shortcut keys must use a cryptographic RNG.'
Assert-True ($Server -match '\$IsShortcutCommand\s*=\s*\$Method\s+-eq\s+"POST"\s+-and\s+\$Path\s+-eq\s+"/api/shortcuts/prepare"') 'The non-browser exception must be limited to the Siri prepare endpoint.'
Assert-True ($Server -match '\$IsRemoteTailscaleRequest\s+-and[\s\S]*Test-DriveOSShortcutToken') 'Siri commands must require both Tailscale identity and the shortcut key.'
Assert-True ($Server -match 'AddSeconds\(-90\)') 'Siri duplicate-command protection is missing.'

$Installer = Get-Content (Join-Path $Root 'tools\Install-DriveOS-App.ps1') -Raw
Assert-True ($Installer -match 'Sort-Object Name') 'Desktop source compilation order must be deterministic.'
Assert-True ($Installer -match 'SkipShortcut') 'Staged installs must be able to avoid desktop mutation.'
Assert-True ($Installer -match 'OrdinalIgnoreCase') 'In-place installation must not copy the icon onto itself.'

& (Join-Path $Root 'tools\Test-CleanInstall.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Phase 4 host, security, release, and clean-install checks passed.' -ForegroundColor Green
