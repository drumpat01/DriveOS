Set-StrictMode -Version 2.0

function Split-DriveOSMigrationStatements {
    param([Parameter(Mandatory=$true)][string]$Sql)

    $Statements = New-Object System.Collections.Generic.List[string]
    $Buffer = New-Object System.Text.StringBuilder

    foreach ($Line in @($Sql -split "`r?`n")) {
        $Trimmed = $Line.Trim()
        if (-not $Trimmed -or $Trimmed.StartsWith('--')) { continue }

        [void]$Buffer.AppendLine($Line)
        if ($Trimmed.EndsWith(';')) {
            $Statement = $Buffer.ToString().Trim()
            if ($Statement) { $Statements.Add($Statement) }
            [void]$Buffer.Clear()
        }
    }

    $Remainder = $Buffer.ToString().Trim()
    if ($Remainder) { throw 'Migration SQL must terminate every statement with a semicolon.' }
    return @($Statements)
}

function Get-DriveOSOrderedMigrations {
    param([string]$Path=(Join-Path $PSScriptRoot 'Migrations'))

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Migration directory is missing: $Path"
    }

    $Migrations = @()
    foreach ($File in @(Get-ChildItem -LiteralPath $Path -File -Filter '*.sql' | Sort-Object Name)) {
        if ($File.Name -notmatch '^(\d{4})_[a-z0-9_]+\.sql$') {
            throw "Invalid migration filename: $($File.Name)"
        }

        $Migrations += [PSCustomObject]@{
            Version = [int]$Matches[1]
            Name = $File.Name
            Path = $File.FullName
            Statements = @(Split-DriveOSMigrationStatements -Sql (Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8))
        }
    }

    if (-not $Migrations.Count) { throw 'At least one database migration is required.' }
    for ($Index = 0; $Index -lt $Migrations.Count; $Index++) {
        $Expected = $Index + 1
        if ($Migrations[$Index].Version -ne $Expected) {
            throw "Database migrations must be contiguous. Expected version $Expected, found $($Migrations[$Index].Version)."
        }
    }

    return @($Migrations)
}

Export-ModuleMember -Function Split-DriveOSMigrationStatements,Get-DriveOSOrderedMigrations
