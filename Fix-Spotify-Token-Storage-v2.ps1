$ErrorActionPreference = "Stop"

$Path = Join-Path $PSScriptRoot "DriveOS-Server.ps1"

if (-not (Test-Path $Path -PathType Leaf)) {
    throw "DriveOS-Server.ps1 was not found next to this patch script."
}

$ResolvedPath = (Resolve-Path $Path).Path
$Text = [System.IO.File]::ReadAllText($ResolvedPath)

function Update-SpotifyTursoCondition {
    param(
        [Parameter(Mandatory=$true)][string]$Source,
        [Parameter(Mandatory=$true)][string]$FunctionName
    )

    $FunctionMarker = "function $FunctionName {"
    $Start = $Source.IndexOf($FunctionMarker, [StringComparison]::Ordinal)

    if ($Start -lt 0) {
        throw "${FunctionName} was not found. Nothing changed."
    }

    $NextFunction = $Source.IndexOf(
        "`nfunction ",
        $Start + $FunctionMarker.Length,
        [StringComparison]::Ordinal
    )

    if ($NextFunction -lt 0) {
        $NextFunction = $Source.Length
    }

    $Before = $Source.Substring(0, $Start)
    $Block = $Source.Substring($Start, $NextFunction - $Start)
    $After = $Source.Substring($NextFunction)

    $Old = 'if ($Repository.Provider -eq "Turso") {'
    $New = 'if ($RuntimeConfig.IsWeb -and $Repository.Provider -eq "Turso") {'

    $Count = ([regex]::Matches(
        $Block,
        [regex]::Escape($Old)
    )).Count

    if ($Count -ne 1) {
        throw "${FunctionName}: expected exactly 1 Turso condition, found $Count. Nothing changed."
    }

    $UpdatedBlock = $Block.Replace($Old, $New)

    return $Before + $UpdatedBlock + $After
}

$Candidate = Update-SpotifyTursoCondition `
    -Source $Text `
    -FunctionName "Save-SpotifyTokenCache"

$Candidate = Update-SpotifyTursoCondition `
    -Source $Candidate `
    -FunctionName "Get-SpotifyTokenCache"

$Tokens = $null
$Errors = $null

[System.Management.Automation.Language.Parser]::ParseInput(
    $Candidate,
    [ref]$Tokens,
    [ref]$Errors
) | Out-Null

if ($Errors.Count -gt 0) {
    $Errors | Format-List
    throw "PowerShell syntax validation failed. DriveOS-Server.ps1 was NOT changed."
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$ResolvedPath.spotify-token-fix-$Stamp.bak"
Copy-Item $ResolvedPath $Backup -Force

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $ResolvedPath,
    $Candidate,
    $Utf8NoBom
)

Write-Host ""
Write-Host "Spotify token storage patch installed." -ForegroundColor Green
Write-Host "Updated: Save-SpotifyTokenCache" -ForegroundColor Green
Write-Host "Updated: Get-SpotifyTokenCache" -ForegroundColor Green
Write-Host "Syntax validation: OK" -ForegroundColor Green
Write-Host "Backup: $Backup"
Write-Host ""
Write-Host "Next run:" -ForegroundColor Cyan
Write-Host "git --no-pager diff -- DriveOS-Server.ps1"
