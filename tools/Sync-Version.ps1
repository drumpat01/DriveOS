param([switch]$Check)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Metadata = Get-Content (Join-Path $Root "version.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = [string]$Metadata.version
$WebBuild = [string]$Metadata.webBuild
if ($Version -notmatch '^\d+\.\d+\.\d+$' -or $WebBuild -notmatch '^\d+\.\d+\.\d+$') { throw "version.json contains an invalid semantic version." }
$VersionParts = $Version.Split('.')
$DisplayVersion = "$($VersionParts[0]).$($VersionParts[1])"

$Expected = @{
    (Join-Path $Root "web\build.json") = "{`n  `"product`": `"DriveOS`",`n  `"version`": `"$Version`",`n  `"webBuild`": `"$WebBuild`",`n  `"features`": [`n    `"friendly-places`",`n    `"charging-history`",`n    `"monthly-recap`"`n  ],`n  `"css`": `"/styles.css?v=$WebBuild`",`n  `"js`": `"/app.js?v=$WebBuild`"`n}`n"
    (Join-Path $Root "web\core\build.js") = "(function () {`n  window.DriveOSBuild = Object.freeze({ version: `"$Version`", webBuild: `"$WebBuild`" });`n  document.documentElement.dataset.webBuild = window.DriveOSBuild.webBuild;`n})();`n"
}

foreach ($Entry in $Expected.GetEnumerator()) {
    $Current = if (Test-Path $Entry.Key) { Get-Content $Entry.Key -Raw } else { "" }
    if ($Check) {
        if (($Current -replace "`r`n", "`n") -ne ($Entry.Value -replace "`r`n", "`n")) { throw "Generated version file is stale: $($Entry.Key)" }
    } else {
        [IO.File]::WriteAllText($Entry.Key, $Entry.Value, (New-Object Text.UTF8Encoding($false)))
    }
}

$ProgramPath = Join-Path $Root "desktop\Program.cs"
$Program = Get-Content $ProgramPath -Raw
$UpdatedProgram = $Program `
    -replace 'AssemblyVersion\("[0-9.]+"\)', "AssemblyVersion(`"$Version.0`")" `
    -replace 'AssemblyFileVersion\("[0-9.]+"\)', "AssemblyFileVersion(`"$Version.0`")" `
    -replace 'AssemblyInformationalVersion\("[0-9.]+"\)', "AssemblyInformationalVersion(`"$Version`")" `
    -replace 'Text = "DriveOS [0-9.]+"', "Text = `"DriveOS $DisplayVersion`""
if ($Check) {
    if ($UpdatedProgram -ne $Program) { throw "desktop/Program.cs version is stale." }
} else {
    [IO.File]::WriteAllText($ProgramPath, $UpdatedProgram, (New-Object Text.UTF8Encoding($false)))
}

$TextReplacements = @{
    (Join-Path $Root "web\service-worker.js") = @('driveos-shell-[0-9.]+', "driveos-shell-$WebBuild")
    (Join-Path $Root "web\index.html") = @('/([A-Za-z0-9_/-]+)\.js\?v=[0-9.]+', "/`$1.js?v=$WebBuild")
}
foreach ($Entry in $TextReplacements.GetEnumerator()) {
    $Current = Get-Content $Entry.Key -Raw
    $Updated = $Current -replace $Entry.Value[0], $Entry.Value[1]
    if ($Check) {
        if ($Updated -ne $Current) { throw "Version reference is stale: $($Entry.Key)" }
    } else {
        [IO.File]::WriteAllText($Entry.Key, $Updated, (New-Object Text.UTF8Encoding($false)))
    }
}

$IndexPath = Join-Path $Root "web\index.html"
$Index = Get-Content $IndexPath -Raw
$UpdatedIndex = [regex]::Replace(
    $Index,
    '(<div class="app-version"[^>]*>)[0-9.]+(</div>)',
    { param($Match) $Match.Groups[1].Value + $Version + $Match.Groups[2].Value }
)
$UpdatedIndex = [regex]::Replace(
    $UpdatedIndex,
    '(<strong id="ignitionVersion">)[0-9.]+(</strong>)',
    { param($Match) $Match.Groups[1].Value + $DisplayVersion + $Match.Groups[2].Value }
)
$UpdatedIndex = [regex]::Replace(
    $UpdatedIndex,
    '(id="webBuildFooter">DriveOS Web )[0-9.]+(<)',
    { param($Match) $Match.Groups[1].Value + $WebBuild + $Match.Groups[2].Value }
)
if ($Check) {
    if ($UpdatedIndex -ne $Index) { throw "Visible version metadata is stale: $IndexPath" }
} else {
    [IO.File]::WriteAllText($IndexPath, $UpdatedIndex, (New-Object Text.UTF8Encoding($false)))
}

Write-Host "DriveOS version metadata is synchronized at $Version (web $WebBuild)."
