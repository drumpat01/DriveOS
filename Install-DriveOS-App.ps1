param([switch]$NoPause)
& (Join-Path $PSScriptRoot "tools\Install-DriveOS-App.ps1") -NoPause:$NoPause
exit $LASTEXITCODE
