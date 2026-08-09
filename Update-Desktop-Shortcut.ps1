param([switch]$NoPause)
& (Join-Path $PSScriptRoot "tools\Update-Desktop-Shortcut.ps1") -NoPause:$NoPause
exit $LASTEXITCODE
