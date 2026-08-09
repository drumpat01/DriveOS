$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\Phase1.Tests.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\Phase2.Tests.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\Phase3.Tests.ps1') -NodePath $env:DRIVEOS_NODE
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\Phase4.Tests.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$parseErrors = @()
Get-ChildItem $Root -Recurse -Include *.ps1,*.psm1 | ForEach-Object {
    $tokens = $null; $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors)
    $parseErrors += @($errors)
}
if ($parseErrors.Count) { $parseErrors | Format-List; exit 1 }

$nodePath = $env:DRIVEOS_NODE
if (-not $nodePath) { $node = Get-Command node.exe -ErrorAction SilentlyContinue; if ($node) { $nodePath = $node.Source } }
if ($nodePath) {
    Get-ChildItem (Join-Path $Root 'web') -Recurse -Filter *.js | ForEach-Object {
        & $nodePath --check $_.FullName
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
} else {
    Write-Warning 'Node.js is unavailable; JavaScript syntax validation was skipped.'
}

Write-Host 'All available DriveOS validations passed.' -ForegroundColor Green
