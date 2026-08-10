Set-StrictMode -Version 2.0

function New-DriveOSRepository {
    param(
        [Parameter(Mandatory=$true)]
        [string]$DataDirectory,

        [string]$AppRoot=(Split-Path -Parent $DataDirectory),

        [ValidateSet('Auto','Json','SQLite')]
        [string]$Provider='Auto'
    )

    $configPath = Join-Path $DataDirectory 'repository-provider.json'

    if ($Provider -eq 'Auto' -and $env:DRIVEOS_REPOSITORY_PROVIDER) {
        $RequestedProvider = "$($env:DRIVEOS_REPOSITORY_PROVIDER)".Trim()

        if ($RequestedProvider -notin @('Json', 'SQLite')) {
            throw 'DRIVEOS_REPOSITORY_PROVIDER must be Json or SQLite.'
        }

        $Provider = $RequestedProvider
    }

    if ($Provider -eq 'Auto') {
        $Provider = 'Json'

        if (Test-Path -LiteralPath $configPath) {
            try {
                $config = Read-DriveOSJson -Path $configPath

                if ($config.provider -eq 'SQLite') {
                    $Provider = 'SQLite'
                }
            }
            catch {}
        }
    }

    $sqliteExecutable = $null

    if ($IsWindows -or $env:OS -eq 'Windows_NT') {
        $sqliteExecutable = Join-Path $AppRoot 'tools\sqlite\sqlite3.exe'
    }
    else {
        $SqliteCommand = Get-Command sqlite3 -ErrorAction SilentlyContinue

        if ($SqliteCommand) {
            $sqliteExecutable = $SqliteCommand.Source
        }
    }

    if (
        $Provider -eq 'SQLite' -and
        (
            -not $sqliteExecutable -or
            -not (Test-Path -LiteralPath $sqliteExecutable -PathType Leaf)
        )
    ) {
        throw 'SQLite is configured but its runtime is missing.'
    }

    [PSCustomObject]@{
        Provider = $Provider
        DataDirectory = $DataDirectory
        SpotifyHistoryPath = Join-Path $DataDirectory 'spotify-history.jsonl'
        PlaceAliasesPath = Join-Path $DataDirectory 'place-aliases.json'
        ChargingSettingsPath = Join-Path $DataDirectory 'charging-settings.json'
        ConfigPath = $configPath
        DatabasePath = Join-Path $DataDirectory 'driveos.db'
        SqliteExecutable = $sqliteExecutable
    }
}

function Get-DriveOSListeningHistory {
    param([Parameter(Mandatory=$true)]$Repository)
    if($Repository.Provider -eq 'SQLite'){return @(Get-DriveOSSqliteHistory -Repository $Repository)}
    Assert-JsonRepository $Repository
    return @(Read-DriveOSJsonLines -Path $Repository.SpotifyHistoryPath)
}

function Add-DriveOSListeningHistoryRecord {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)]$Record)
    if($Repository.Provider -eq 'SQLite'){Add-DriveOSSqliteHistoryRecord -Repository $Repository -Record $Record;return}
    Assert-JsonRepository $Repository
    Add-DriveOSJsonLine -Path $Repository.SpotifyHistoryPath -Value $Record
}

function Get-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository)
    if($Repository.Provider -eq 'SQLite'){return @(Get-DriveOSSqliteAliases -Repository $Repository)}
    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.PlaceAliasesPath -Default @())
}

function Set-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)][object[]]$Entries)
    if($Repository.Provider -eq 'SQLite'){Set-DriveOSSqliteAliases -Repository $Repository -Entries $Entries;return}
    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.PlaceAliasesPath -Value @($Entries)
}

function Get-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository)
    if($Repository.Provider -eq 'SQLite'){return Get-DriveOSSqliteSettings -Repository $Repository}
    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.ChargingSettingsPath
}

function Set-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository, [Parameter(Mandatory=$true)]$Settings)
    if($Repository.Provider -eq 'SQLite'){Set-DriveOSSqliteSettings -Repository $Repository -Settings $Settings;return}
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
