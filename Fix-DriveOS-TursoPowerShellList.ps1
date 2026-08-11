$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$TursoPath = Join-Path $Root "src\Storage\DriveOS.Turso.psm1"

if (-not (Test-Path $TursoPath -PathType Leaf)) {
    throw "Run this script from the DriveOS repository root."
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $Branch = (& git branch --show-current 2>$null).Trim()

    if ($Branch -and $Branch -ne "web-hosting-prep") {
        throw "This fix must be applied on web-hosting-prep. Current branch: $Branch"
    }
}

$Text = [IO.File]::ReadAllText($TursoPath) -replace "`r`n", "`n"

$Old1 = '$Requests = New-Object System.Collections.Generic.List[object]'
$New1 = '$Requests = [System.Collections.Generic.List[object]]::new()'

if (-not $Text.Contains($Old1)) {
    throw "Could not find the Turso request list constructor."
}

$Text = $Text.Replace($Old1, $New1)

$Old2 = 'requests = @($Requests)'
$New2 = 'requests = $Requests.ToArray()'

if (-not $Text.Contains($Old2)) {
    throw "Could not find the Turso request array conversion."
}

$Text = $Text.Replace($Old2, $New2)

$Old3 = '$Statements = New-Object System.Collections.Generic.List[object]'
$New3 = '$Statements = [System.Collections.Generic.List[object]]::new()'

if (-not $Text.Contains($Old3)) {
    throw "Could not find the Turso statement list constructor."
}

$Text = $Text.Replace($Old3, $New3)

$Old4 = '-Statements @($Statements)'
$New4 = '-Statements $Statements.ToArray()'

if (-not $Text.Contains($Old4)) {
    throw "Could not find the Turso statement array conversion."
}

$Text = $Text.Replace($Old4, $New4)

$Encoding = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($TursoPath, $Text, $Encoding)

Write-Host ""
Write-Host "PowerShell List[object] compatibility fix applied." -ForegroundColor Green
Write-Host ""
Write-Host "Run:"
Write-Host "  .\tests\Turso.Tests.ps1"
Write-Host "  .\tests\WebDeployment.Tests.ps1"
