$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'Stop-AtlasNodeLocal.ps1')
if (Get-NetTCPConnection -LocalPort 8791 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8791 is still occupied; rollback proxy was not started.' }
$Node = (Get-Command node -ErrorAction Stop).Source
$LogDirectory = Join-Path $Root 'logs\atlas-node-rollback'; [IO.Directory]::CreateDirectory($LogDirectory) | Out-Null
$Process = Start-Process -FilePath $Node -ArgumentList @('tools\beta-live-proxy.mjs') -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDirectory 'stdout.log') -RedirectStandardError (Join-Path $LogDirectory 'stderr.log') -Environment @{ DRIVEOS_BETA_PORT='8791'; DRIVEOS_BETA_HOST='127.0.0.1'; DRIVEOS_BETA_UPSTREAM='https://journeydeck.me' } -PassThru
Write-Output "Previous local live-proxy architecture restored on port 8791 (PID $($Process.Id))."
