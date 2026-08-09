$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Scratch = Join-Path $Root 'artifacts\clean-install-test'

& (Join-Path $PSScriptRoot 'Build-Release.ps1') -OutputRoot $Scratch -SkipArchive

$Version = (Get-Content (Join-Path $Root 'version.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$Stage = Join-Path $Scratch "DriveOS-$Version"
$Required = @(
    'DriveOS.exe', 'DriveOS-Backend.ps1', 'DriveOS-Server.ps1',
    'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll',
    'WebView2Loader.dll', 'version.json', 'artifact-manifest.json',
    'web/index.html', 'src/Repositories/DriveOS.Repository.psm1'
)

foreach ($RelativePath in $Required) {
    if (-not (Test-Path (Join-Path $Stage $RelativePath) -PathType Leaf)) {
        throw "Clean release is missing required file: $RelativePath"
    }
}

$Forbidden = @(Get-ChildItem $Stage -Recurse -Force | Where-Object {
    $_.FullName -match '([\\/])data([\\/]|$)' -or
    $_.Name -eq '.env' -or
    $_.Name -match '(?i)token' -or
    $_.Name -match '(?i)secret.*\.json$'
})
if ($Forbidden.Count -gt 0) {
    throw "Private runtime files entered the clean release: $($Forbidden.FullName -join ', ')"
}

$Manifest = Get-Content (Join-Path $Stage 'artifact-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($File in $Manifest.files) {
    $Path = Join-Path $Stage $File.path
    $Hash = (Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Hash -ne $File.sha256) { throw "Checksum mismatch: $($File.path)" }
}

Write-Host 'Clean-install staging, required-file, privacy, compile, and checksum checks passed.' -ForegroundColor Green
