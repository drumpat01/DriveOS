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
$DesktopProgram = Get-Content (Join-Path $Root 'desktop\Program.cs') -Raw
Assert-True ($DesktopProgram -match 'blob:' -and $DesktopProgram -match 'image/png' -and
    $DesktopProgram -match 'SaveFileDialog') 'Share-card PNG downloads must use the restricted local save workflow.'
Assert-True ($DesktopProgram -match 'if \(!isDriveOSShareCard\)') 'Non-share-card downloads must remain blocked.'
Assert-True ($DesktopProgram -match 'private void OnFormClosing[\s\S]*ShutdownBackend\(\);[\s\S]*Environment\.Exit\(0\)') 'Desktop close must stop the backend before forcing lingering WebView2 threads to exit.'
$ShutdownBody = [regex]::Match($DesktopProgram, 'private void ShutdownBackend\(\)[\s\S]*?\n        \}').Value
Assert-True ($ShutdownBody -match 'backendHost\.Dispose\(\)') 'Desktop close must stop the local backend.'
Assert-True ($ShutdownBody -match 'Task\.Run' -and $ShutdownBody -match 'Wait\(2500\)') 'Backend shutdown must be bounded so the desktop UI cannot remain stuck.'
Assert-True ($ShutdownBody -notmatch 'browser\.Dispose\(\)') 'FormClosing must not synchronously dispose WebView2 before backend shutdown.'

$Installer = Get-Content (Join-Path $Root 'tools\Install-DriveOS-App.ps1') -Raw
Assert-True ($Installer -match 'Sort-Object Name') 'Desktop source compilation order must be deterministic.'
Assert-True ($Installer -match 'SkipShortcut') 'Staged installs must be able to avoid desktop mutation.'
Assert-True ($Installer -match 'OrdinalIgnoreCase') 'In-place installation must not copy the icon onto itself.'

& (Join-Path $Root 'tools\Test-CleanInstall.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Phase 4 host, security, release, and clean-install checks passed.' -ForegroundColor Green
