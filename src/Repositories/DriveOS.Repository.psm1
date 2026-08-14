Set-StrictMode -Version 2.0

function New-DriveOSRepository {
    param(
        [Parameter(Mandatory=$true)][string]$DataDirectory,
        [string]$AppRoot=(Split-Path -Parent $DataDirectory),
        [ValidateSet('Auto','Json','SQLite','Turso')][string]$Provider='Auto'
    )

    $configPath = Join-Path $DataDirectory 'repository-provider.json'

    if ($Provider -eq 'Auto' -and $env:DRIVEOS_REPOSITORY_PROVIDER) {
        $RequestedProvider = "$($env:DRIVEOS_REPOSITORY_PROVIDER)".Trim()

        if ($RequestedProvider -notin @('Json','SQLite','Turso')) {
            throw 'DRIVEOS_REPOSITORY_PROVIDER must be Json, SQLite, or Turso.'
        }

        $Provider = $RequestedProvider
    }

    if ($Provider -eq 'Auto') {
        $Provider = 'Json'

        if (Test-Path -LiteralPath $configPath) {
            try {
                $config = Read-DriveOSJson -Path $configPath

                if ($config.provider -in @('SQLite','Turso')) {
                    $Provider = "$($config.provider)"
                }
            }
            catch {}
        }
    }

    $sqliteExecutable = $null

    if ($Provider -eq 'SQLite') {
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
            -not $sqliteExecutable -or
            -not (Test-Path -LiteralPath $sqliteExecutable -PathType Leaf)
        ) {
            throw 'SQLite is configured but its runtime is missing.'
        }
    }

    $TursoDatabaseUrl = $null
    $TursoAuthToken = $null

    if ($Provider -eq 'Turso') {
        $TursoDatabaseUrl = "$($env:TURSO_DATABASE_URL)".Trim()
        $TursoAuthToken = "$($env:TURSO_AUTH_TOKEN)".Trim()

        if (-not $TursoDatabaseUrl) {
            throw 'TURSO_DATABASE_URL is required for the Turso repository.'
        }

        if (-not $TursoAuthToken) {
            throw 'TURSO_AUTH_TOKEN is required for the Turso repository.'
        }

        $null = Get-DriveOSTursoHttpUrl -DatabaseUrl $TursoDatabaseUrl
    }

    [PSCustomObject]@{
        Provider = $Provider
        DataDirectory = $DataDirectory
        SpotifyHistoryPath = Join-Path $DataDirectory 'spotify-history.jsonl'
        DriveSoundtracksPath = Join-Path $DataDirectory 'drive-soundtracks.json'
        PlaceAliasesPath = Join-Path $DataDirectory 'place-aliases.json'
        ChargingSettingsPath = Join-Path $DataDirectory 'charging-settings.json'
        DashboardLayoutPath = Join-Path $DataDirectory 'dashboard-layout.json'
        ConfigPath = $configPath
        DatabasePath = Join-Path $DataDirectory 'driveos.db'
        SqliteExecutable = $sqliteExecutable
        TursoDatabaseUrl = $TursoDatabaseUrl
        TursoAuthToken = $TursoAuthToken
    }
}

function Get-DriveOSListeningHistory {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteHistory -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoHistory -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJsonLines -Path $Repository.SpotifyHistoryPath)
}

function Add-DriveOSListeningHistoryRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Record)

    if ($Repository.Provider -eq 'SQLite') {
        Add-DriveOSSqliteHistoryRecord -Repository $Repository -Record $Record
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Add-DriveOSTursoHistoryRecord -Repository $Repository -Record $Record
        return
    }

    Assert-JsonRepository $Repository
    Add-DriveOSJsonLine -Path $Repository.SpotifyHistoryPath -Value $Record
}

function Get-DriveOSDriveSoundtracks {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteSoundtracks -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoSoundtracks -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.DriveSoundtracksPath -Default @())
}

function Set-DriveOSDriveSoundtrack {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Record)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteSoundtrack -Repository $Repository -Record $Record
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoSoundtrack -Repository $Repository -Record $Record
        return
    }

    Assert-JsonRepository $Repository
    $Records = @(Read-DriveOSJson -Path $Repository.DriveSoundtracksPath -Default @() | Where-Object { "$($_.driveId)" -ne "$($Record.driveId)" })
    Write-DriveOSJson -Path $Repository.DriveSoundtracksPath -Value @($Records + $Record)
}

function Get-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return @(Get-DriveOSSqliteAliases -Repository $Repository)
    }

    if ($Repository.Provider -eq 'Turso') {
        return @(Get-DriveOSTursoAliases -Repository $Repository)
    }

    Assert-JsonRepository $Repository
    return @(Read-DriveOSJson -Path $Repository.PlaceAliasesPath -Default @())
}

function Set-DriveOSPlaceAliases {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)][object[]]$Entries)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteAliases -Repository $Repository -Entries $Entries
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoAliases -Repository $Repository -Entries $Entries
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.PlaceAliasesPath -Value @($Entries)
}

function Get-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return Get-DriveOSSqliteSettings -Repository $Repository
    }

    if ($Repository.Provider -eq 'Turso') {
        return Get-DriveOSTursoSettings -Repository $Repository
    }

    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.ChargingSettingsPath
}

function Set-DriveOSChargingSettingsRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$Settings)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteSettings -Repository $Repository -Settings $Settings
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoSettings -Repository $Repository -Settings $Settings
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.ChargingSettingsPath -Value $Settings
}

function Get-DriveOSDashboardLayoutRecord {
    param([Parameter(Mandatory=$true)]$Repository)

    if ($Repository.Provider -eq 'SQLite') {
        return Get-DriveOSSqliteDashboardLayout -Repository $Repository
    }

    if ($Repository.Provider -eq 'Turso') {
        return Get-DriveOSTursoState -Repository $Repository -Key 'dashboard-layout'
    }

    Assert-JsonRepository $Repository
    return Read-DriveOSJson -Path $Repository.DashboardLayoutPath
}

function Set-DriveOSDashboardLayoutRecord {
    param([Parameter(Mandatory=$true)]$Repository,[Parameter(Mandatory=$true)]$LayoutRecord)

    if ($Repository.Provider -eq 'SQLite') {
        Set-DriveOSSqliteDashboardLayout -Repository $Repository -LayoutRecord $LayoutRecord
        return
    }

    if ($Repository.Provider -eq 'Turso') {
        Set-DriveOSTursoState -Repository $Repository -Key 'dashboard-layout' -Value $LayoutRecord
        return
    }

    Assert-JsonRepository $Repository
    Write-DriveOSJson -Path $Repository.DashboardLayoutPath -Value $LayoutRecord
}

function Assert-JsonRepository {
    param($Repository)

    if (-not $Repository -or $Repository.Provider -ne 'Json') {
        throw 'The configured DriveOS repository provider is not supported by this build.'
    }
}

Export-ModuleMember -Function `
    New-DriveOSRepository, `
    Get-DriveOSListeningHistory, `
    Add-DriveOSListeningHistoryRecord, `
    Get-DriveOSDriveSoundtracks, `
    Set-DriveOSDriveSoundtrack, `
    Get-DriveOSPlaceAliases, `
    Set-DriveOSPlaceAliases, `
    Get-DriveOSChargingSettingsRecord, `
    Set-DriveOSChargingSettingsRecord, `
    Get-DriveOSDashboardLayoutRecord, `
    Set-DriveOSDashboardLayoutRecord
