[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SettingsPath = Join-Path $Root 'PSScriptAnalyzerSettings.psd1'

$AnalyzerModule = Get-Module -ListAvailable PSScriptAnalyzer |
    Sort-Object Version -Descending |
    Select-Object -First 1

if (-not $AnalyzerModule) {
    $CandidateRoots = @(
        (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'PowerShell\Modules\PSScriptAnalyzer'),
        (Join-Path $HOME 'OneDrive\Documents\PowerShell\Modules\PSScriptAnalyzer'),
        (Join-Path $HOME 'Documents\PowerShell\Modules\PSScriptAnalyzer')
    )
    $AnalyzerModule = $CandidateRoots |
        Where-Object { Test-Path -LiteralPath $_ -PathType Container } |
        ForEach-Object { Get-ChildItem -LiteralPath $_ -Recurse -Filter 'PSScriptAnalyzer.psd1' } |
        Sort-Object FullName -Descending |
        Select-Object -First 1
}

if (-not $AnalyzerModule) { throw 'PSScriptAnalyzer is not installed.' }
$AnalyzerModulePath = if ($AnalyzerModule -is [System.IO.FileInfo]) {
    $AnalyzerModule.FullName
}
else {
    $AnalyzerModule.Path
}
if ([string]::IsNullOrWhiteSpace($AnalyzerModulePath)) {
    throw 'PSScriptAnalyzer was found, but its module manifest path could not be resolved.'
}
Import-Module -Name $AnalyzerModulePath -ErrorAction Stop

$TrackedFiles = @(
    & git -C $Root ls-files -- '*.ps1' '*.psm1' '*.psd1'
    if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate tracked PowerShell files.' }
)

$Results = @(
    foreach ($RelativePath in $TrackedFiles) {
        Invoke-ScriptAnalyzer -Path (Join-Path $Root $RelativePath) -Settings $SettingsPath
    }
)

if ($Results.Count -gt 0) {
    $Results |
        Select-Object RuleName, Severity, ScriptName, Line, Message |
        Format-Table -Wrap
    throw "PSScriptAnalyzer found $($Results.Count) blocking issue(s)."
}

Write-Host "PSScriptAnalyzer passed for $($TrackedFiles.Count) tracked PowerShell files."
