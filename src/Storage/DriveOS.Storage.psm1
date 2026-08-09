Set-StrictMode -Version 2.0

function Read-DriveOSJson {
    param([Parameter(Mandatory=$true)][string]$Path, $Default = $null)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $Default }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return $Default }
    return $raw | ConvertFrom-Json
}

function Write-DriveOSJson {
    param([Parameter(Mandatory=$true)][string]$Path, [Parameter(Mandatory=$true)]$Value)
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }
    $json = $Value | ConvertTo-Json -Depth 20
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, ($json + "`r`n"), $utf8)
}

function Read-DriveOSJsonLines {
    param([Parameter(Mandatory=$true)][string]$Path)
    $records = @()
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $records }
    Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
        if (-not [string]::IsNullOrWhiteSpace($_)) {
            try { $records += ($_ | ConvertFrom-Json) } catch { }
        }
    }
    return $records
}

function Add-DriveOSJsonLine {
    param([Parameter(Mandatory=$true)][string]$Path, [Parameter(Mandatory=$true)]$Value)
    $directory = Split-Path -Parent $Path
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }
    ($Value | ConvertTo-Json -Depth 20 -Compress) | Add-Content -LiteralPath $Path -Encoding UTF8
}

Export-ModuleMember -Function Read-DriveOSJson,Write-DriveOSJson,Read-DriveOSJsonLines,Add-DriveOSJsonLine
