function ConvertTo-SqlLiteral {
    param([AllowNull()][string]$Value)
    if ($null -eq $Value) { return 'NULL' }
    return "'" + $Value.Replace("'", "''") + "'"
}

function Invoke-DriveOSSqlite {
    param([Parameter(Mandatory=$true)][string]$Executable,[Parameter(Mandatory=$true)][string]$Database,[Parameter(Mandatory=$true)][string]$Sql,[switch]$Json)
    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { throw "SQLite runtime is missing: $Executable" }
    $arguments = @('-batch','-bail')
    if ($Json) { $arguments += '-json' }
    $arguments += $Database
    $output = ($Sql + "`n") | & $Executable @arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SQLite failed: $($output -join ' ')" }
    if ($Json) {
        $text = ($output -join "`n").Trim()
        if (-not $text) { return @() }
        return @($text | ConvertFrom-Json)
    }
    return $output
}

function Initialize-DriveOSSqlite {
    param($Repository)
    $sql = @'
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS listening_history(id TEXT PRIMARY KEY, played_at TEXT, payload_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_listening_history_played_at ON listening_history(played_at);
CREATE TABLE IF NOT EXISTS place_aliases(location TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(1,datetime('now'));
'@
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteHistory {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT payload_json FROM listening_history ORDER BY played_at,id;' -Json)
    return @($rows | ForEach-Object { $_.payload_json | ConvertFrom-Json })
}

function Add-DriveOSSqliteHistoryRecord {
    param($Repository,$Record)
    $payload = $Record | ConvertTo-Json -Depth 20 -Compress
    $sql = "INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES($(ConvertTo-SqlLiteral ([string]$Record.id)),$(ConvertTo-SqlLiteral ([string]$Record.played_at)),$(ConvertTo-SqlLiteral $payload));"
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteAliases {
    param($Repository)
    return @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'SELECT location,label FROM place_aliases ORDER BY location;' -Json)
}

function Set-DriveOSSqliteAliases {
    param($Repository,[object[]]$Entries)
    $statements = @('BEGIN IMMEDIATE;','DELETE FROM place_aliases;')
    foreach($entry in @($Entries)){ $statements += "INSERT INTO place_aliases(location,label) VALUES($(ConvertTo-SqlLiteral ([string]$entry.location)),$(ConvertTo-SqlLiteral ([string]$entry.label)));" }
    $statements += 'COMMIT;'
    $null = Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($statements -join "`n")
}

function Get-DriveOSSqliteSettings {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT value_json FROM settings WHERE key='charging';" -Json)
    if (-not $rows.Count) { return $null }
    return $rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSSqliteSettings {
    param($Repository,$Settings)
    $payload=$Settings|ConvertTo-Json -Depth 20 -Compress
    $sql="INSERT OR REPLACE INTO settings(key,value_json) VALUES('charging',$(ConvertTo-SqlLiteral $payload));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Get-DriveOSSqliteDashboardLayout {
    param($Repository)
    $rows = @(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql "SELECT value_json FROM settings WHERE key='dashboard-layout';" -Json)
    if (-not $rows.Count) { return $null }
    return $rows[0].value_json | ConvertFrom-Json
}

function Set-DriveOSSqliteDashboardLayout {
    param($Repository,$LayoutRecord)
    $payload=$LayoutRecord|ConvertTo-Json -Depth 20 -Compress
    $sql="INSERT OR REPLACE INTO settings(key,value_json) VALUES('dashboard-layout',$(ConvertTo-SqlLiteral $payload));"
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql $sql
}

function Test-DriveOSSqliteIntegrity {
    param($Repository)
    $rows=@(Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql 'PRAGMA integrity_check;' -Json)
    return ($rows.Count -eq 1 -and $rows[0].integrity_check -eq 'ok')
}

function Import-DriveOSSqliteData {
    param($Repository,[object[]]$History=@(),[object[]]$Aliases=@(),$Settings)
    $sql=New-Object System.Collections.Generic.List[string]
    $sql.Add('BEGIN IMMEDIATE;');$sql.Add('DELETE FROM listening_history;');$sql.Add('DELETE FROM place_aliases;');$sql.Add('DELETE FROM settings;')
    foreach($record in @($History)){
        $payload=$record|ConvertTo-Json -Depth 20 -Compress
        $sql.Add("INSERT OR IGNORE INTO listening_history(id,played_at,payload_json) VALUES($(ConvertTo-SqlLiteral ([string]$record.id)),$(ConvertTo-SqlLiteral ([string]$record.played_at)),$(ConvertTo-SqlLiteral $payload));")
    }
    foreach($entry in @($Aliases)){$sql.Add("INSERT INTO place_aliases(location,label) VALUES($(ConvertTo-SqlLiteral ([string]$entry.location)),$(ConvertTo-SqlLiteral ([string]$entry.label)));")}
    if($Settings){$payload=$Settings|ConvertTo-Json -Depth 20 -Compress;$sql.Add("INSERT INTO settings(key,value_json) VALUES('charging',$(ConvertTo-SqlLiteral $payload));")}
    $sql.Add('COMMIT;')
    $null=Invoke-DriveOSSqlite -Executable $Repository.SqliteExecutable -Database $Repository.DatabasePath -Sql ($sql -join "`n")
}

Export-ModuleMember -Function Invoke-DriveOSSqlite,Initialize-DriveOSSqlite,Get-DriveOSSqliteHistory,Add-DriveOSSqliteHistoryRecord,Get-DriveOSSqliteAliases,Set-DriveOSSqliteAliases,Get-DriveOSSqliteSettings,Set-DriveOSSqliteSettings,Get-DriveOSSqliteDashboardLayout,Set-DriveOSSqliteDashboardLayout,Test-DriveOSSqliteIntegrity,Import-DriveOSSqliteData
