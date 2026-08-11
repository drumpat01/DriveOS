Set-StrictMode -Version 2.0

function Get-DriveOSTursoHttpUrl {
    param([Parameter(Mandatory=$true)][string]$DatabaseUrl)

    $Value = "$DatabaseUrl".Trim()

    if ($Value -notmatch '^libsql://([A-Za-z0-9.-]+)(?::\d+)?/?$') {
        throw "TURSO_DATABASE_URL must be a valid libsql:// Turso database URL."
    }

    return "https://$($Matches[1])"
}

function New-DriveOSTursoTextArgument {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return [PSCustomObject]@{ type = "null" }
    }

    return [PSCustomObject]@{
        type = "text"
        value = "$Value"
    }
}

function Invoke-DriveOSTursoPipeline {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][object[]]$Statements
    )

    if (-not $Repository.TursoDatabaseUrl -or -not $Repository.TursoAuthToken) {
        throw "Turso repository credentials are incomplete."
    }

    $BaseUrl = Get-DriveOSTursoHttpUrl -DatabaseUrl $Repository.TursoDatabaseUrl
    $Requests = @()

    foreach ($Statement in $Statements) {
        $Stmt = [ordered]@{ sql = "$($Statement.Sql)" }

        if ($Statement.PSObject.Properties["Args"]) {
            $Stmt.args = @(
                $Statement.Args | ForEach-Object {
                    New-DriveOSTursoTextArgument -Value $_
                }
            )
        }

        $Requests += [PSCustomObject]@{
            type = "execute"
            stmt = [PSCustomObject]$Stmt
        }
    }

    $Requests += [PSCustomObject]@{ type = "close" }

    $Payload = [PSCustomObject]@{
        requests = @($Requests)
    } | ConvertTo-Json -Depth 20 -Compress

    $Response = Invoke-RestMethod `
        -Uri "$BaseUrl/v2/pipeline" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $($Repository.TursoAuthToken)" } `
        -ContentType "application/json" `
        -Body $Payload

    $ExecuteResults = @()

    for ($Index = 0; $Index -lt $Statements.Count; $Index++) {
        $Result = $Response.results[$Index]

        if (-not $Result -or $Result.type -ne "ok") {
            $Message = "Turso query failed."

            if (
                $Result -and
                $Result.PSObject.Properties["error"] -and
                $Result.error.message
            ) {
                $Message = "Turso query failed: $($Result.error.message)"
            }

            throw $Message
        }

        $ExecuteResults += $Result.response.result
    }

    return @($ExecuteResults)
}

function ConvertFrom-DriveOSTursoResultRows {
    param([Parameter(Mandatory=$true)]$Result)

    $Columns = @($Result.cols | ForEach-Object { "$($_.name)" })
    $Objects = @()

    foreach ($Row in @($Result.rows)) {
        $Values = [ordered]@{}

        for ($Index = 0; $Index -lt $Columns.Count; $Index++) {
            $Cell = $Row[$Index]

            if ($null -eq $Cell -or $Cell.type -eq "null") {
                $Values[$Columns[$Index]] = $null
            }
            elseif ($Cell.PSObject.Properties["value"]) {
                $Values[$Columns[$Index]] = $Cell.value
            }
            elseif ($Cell.PSObject.Properties["base64"]) {
                $Values[$Columns[$Index]] = $Cell.base64
            }
            else {
                $Values[$Columns[$Index]] = $null
            }
        }

        $Objects += [PSCustomObject]$Values
    }

    return @($Objects)
}

function Invoke-DriveOSTursoQuery {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Sql,
        [object[]]$Args = @()
    )

    $Statement = [PSCustomObject]@{
        Sql = $Sql
        Args = @($Args)
    }

    $Results = @(Invoke-DriveOSTursoPipeline -Repository $Repository -Statements @($Statement))

    if (-not $Results.Count) {
        return @()
    }

    return @(ConvertFrom-DriveOSTursoResultRows -Result $Results[0])
}

function Invoke-DriveOSTursoExecute {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Sql,
        [object[]]$Args = @()
    )

    $Statement = [PSCustomObject]@{
        Sql = $Sql
        Args = @($Args)
    }

    $null = Invoke-DriveOSTursoPipeline -Repository $Repository -Statements @($Statement)
}

function Initialize-DriveOSTurso {
    param([Parameter(Mandatory=$true)]$Repository)

    $Statements = @(
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS listening_history(id TEXT PRIMARY KEY, played_at TEXT, payload_json TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE INDEX IF NOT EXISTS ix_listening_history_played_at ON listening_history(played_at);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS place_aliases(location TEXT PRIMARY KEY, label TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);" },
        [PSCustomObject]@{ Sql = "CREATE TABLE IF NOT EXISTS app_state(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);" }
    )

    $null = Invoke-DriveOSTursoPipeline -Repository $Repository -Statements $Statements
}

function Get-DriveOSTursoHistory {
    param([Parameter(Mandatory=$true)]$Repository)

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT payload_json FROM listening_history ORDER BY played_at,id;")

    return @($Rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Add-DriveOSTursoHistoryRecord {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Record
    )

    $Payload = $Record | ConvertTo-Json -Depth 20 -Compress

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES(?,?,?);" `
        -Args @("$($Record.id)", "$($Record.played_at)", $Payload)
}

function Get-DriveOSTursoAliases {
    param([Parameter(Mandatory=$true)]$Repository)

    return @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT location,label FROM place_aliases ORDER BY location;")
}

function Set-DriveOSTursoAliases {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][object[]]$Entries
    )

    $Statements = @()
    $Statements += [PSCustomObject]@{ Sql = "BEGIN IMMEDIATE;" }
    $Statements += [PSCustomObject]@{ Sql = "DELETE FROM place_aliases;" }

    foreach ($Entry in @($Entries)) {
        $Statements += [PSCustomObject]@{
            Sql = "INSERT INTO place_aliases(location,label) VALUES(?,?);"
            Args = @("$($Entry.location)", "$($Entry.label)")
        }
    }

    $Statements += [PSCustomObject]@{ Sql = "COMMIT;" }

    $null = Invoke-DriveOSTursoPipeline `
        -Repository $Repository `
        -Statements @($Statements)
}

function Get-DriveOSTursoSettings {
    param([Parameter(Mandatory=$true)]$Repository)

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT value_json FROM settings WHERE key='charging';")

    if (-not $Rows.Count) {
        return $null
    }

    return $Rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSTursoSettings {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)]$Settings
    )

    $Payload = $Settings | ConvertTo-Json -Depth 20 -Compress

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT INTO settings(key,value_json) VALUES('charging',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json;" `
        -Args @($Payload)
}

function Get-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key
    )

    $Rows = @(Invoke-DriveOSTursoQuery `
        -Repository $Repository `
        -Sql "SELECT value_json FROM app_state WHERE key=?;" `
        -Args @($Key))

    if (-not $Rows.Count) {
        return $null
    }

    return $Rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key,
        [Parameter(Mandatory=$true)]$Value
    )

    $Payload = $Value | ConvertTo-Json -Depth 20 -Compress
    $UpdatedAt = [DateTimeOffset]::UtcNow.ToString("o")

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "INSERT INTO app_state(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;" `
        -Args @($Key, $Payload, $UpdatedAt)
}

function Remove-DriveOSTursoState {
    param(
        [Parameter(Mandatory=$true)]$Repository,
        [Parameter(Mandatory=$true)][string]$Key
    )

    Invoke-DriveOSTursoExecute `
        -Repository $Repository `
        -Sql "DELETE FROM app_state WHERE key=?;" `
        -Args @($Key)
}

Export-ModuleMember -Function `
    Get-DriveOSTursoHttpUrl, `
    Invoke-DriveOSTursoPipeline, `
    Initialize-DriveOSTurso, `
    Get-DriveOSTursoHistory, `
    Add-DriveOSTursoHistoryRecord, `
    Get-DriveOSTursoAliases, `
    Set-DriveOSTursoAliases, `
    Get-DriveOSTursoSettings, `
    Set-DriveOSTursoSettings, `
    Get-DriveOSTursoState, `
    Set-DriveOSTursoState, `
    Remove-DriveOSTursoState