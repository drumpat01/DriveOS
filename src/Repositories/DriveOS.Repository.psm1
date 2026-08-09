Set-StrictMode -Version 2.0

function New-DriveOSRepository {
    param([Parameter(Mandatory=$true)][string]$DataDirectory, [ValidateSet('Json')][string]$Provider = 'Json')
    [PSCustomObject]@{
        Provider = $Provider
        DataDirectory = $DataDirectory
        SpotifyHistoryPath = Join-Path $DataDirectory 'spotify-history.jsonl'
        PlaceAliasesPath = Join-Path $DataDirectory 'place-aliases.json'
        ChargingSettingsPath = Join-Path $DataDirectory 'charging-settings.json'
    }
}

function Get-DriveOSListeningHistory {
    param([Parameter(Mandatory=$true)]$Repository)
    Assert-JsonRepository $Repository
    return @(Read-DriveOSJsonLines -Path $Repository.SpotifyHistoryPath)
}

function Add-DriveOSListeningHistoryRecord {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)]$Record)
    Assert-JsonRepository $Repository
    Add-DriveOSJsonLine -Path $Repository.SpotifyHistoryPath -Value $Record
}

function Get-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository)
    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.PlaceAliasesPath -Default @())
}

function Set-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)][object[]]$Entries)
    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.PlaceAliasesPath -Value @($Entries)
}

function Get-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository)
    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.ChargingSettingsPath
}

function Set-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)]$Settings)
    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.ChargingSettingsPath -Value $Settings
}

function Assert-JsonRepository {
    param($Repository)
    if (-not $Repository -or $Repository.Provider -ne 'Json') {
        throw 'The configured DriveOS repository provider is not supported by this build.'
    }
}

Export-ModuleMember -Function New-DriveOSRepository,Get-DriveOSListeningHistory,Add-DriveOSListeningHistoryRecord,Get-DriveOSPlaceAliases,Set-DriveOSPlaceAliases,Get-DriveOSChargingSettingsRecord,Set-DriveOSChargingSettingsRecord
