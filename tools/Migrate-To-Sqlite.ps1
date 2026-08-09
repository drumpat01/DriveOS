param([switch]$NoPause)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
$Data=Join-Path $Root 'data'
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Sqlite.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
$null=& (Join-Path $PSScriptRoot 'Install-Sqlite.ps1')
if(-not(Test-Path $Data)){New-Item -ItemType Directory -Path $Data|Out-Null}
$json=New-DriveOSRepository -DataDirectory $Data -AppRoot $Root -Provider Json
$sqlite=New-DriveOSRepository -DataDirectory $Data -AppRoot $Root -Provider SQLite
$stamp=(Get-Date).ToString('yyyyMMdd-HHmmss')
$backup=Join-Path $Data "migration-backups\$stamp"
New-Item -ItemType Directory -Path $backup -Force|Out-Null
foreach($path in @($json.SpotifyHistoryPath,$json.PlaceAliasesPath,$json.ChargingSettingsPath,$json.ConfigPath)){
    if(Test-Path -LiteralPath $path){Copy-Item -LiteralPath $path -Destination $backup -Force}
}
if(Test-Path -LiteralPath $sqlite.DatabasePath){Copy-Item -LiteralPath $sqlite.DatabasePath -Destination (Join-Path $backup 'driveos.db.previous') -Force;Remove-Item -LiteralPath $sqlite.DatabasePath -Force}
Initialize-DriveOSSqlite -Repository $sqlite
$history=@(Get-DriveOSListeningHistory -Repository $json)
foreach($record in $history){Add-DriveOSListeningHistoryRecord -Repository $sqlite -Record $record}
$aliases=@(Get-DriveOSPlaceAliases -Repository $json);Set-DriveOSPlaceAliases -Repository $sqlite -Entries $aliases
$settings=Get-DriveOSChargingSettingsRecord -Repository $json;if($settings){Set-DriveOSChargingSettingsRecord -Repository $sqlite -Settings $settings}
$imported=@(Get-DriveOSListeningHistory -Repository $sqlite)
if($imported.Count -ne $history.Count){throw "History verification failed: expected $($history.Count), imported $($imported.Count)."}
if(@(Get-DriveOSPlaceAliases -Repository $sqlite).Count -ne $aliases.Count){throw 'Alias verification failed.'}
if(-not(Test-DriveOSSqliteIntegrity -Repository $sqlite)){throw 'SQLite integrity verification failed.'}
Write-DriveOSJson -Path $json.ConfigPath -Value ([pscustomobject]@{provider='SQLite';schemaVersion=1;migratedAt=(Get-Date).ToString('o');backup=$backup})
Write-Host "SQLite migration complete. Source files remain unchanged. Backup: $backup" -ForegroundColor Green
if(-not $NoPause){Read-Host 'Press Enter to close'}
