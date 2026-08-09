param([switch]$NoPause)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Data=Join-Path $Root 'data'
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
$Config=Join-Path $Data 'repository-provider.json'
Write-DriveOSJson -Path $Config -Value ([pscustomobject]@{provider='Json';rolledBackAt=(Get-Date).ToString('o')})
Write-Host 'DriveOS will use the unchanged JSON/JSONL source files on its next start.' -ForegroundColor Green
if(-not $NoPause){Read-Host 'Press Enter to close'}
