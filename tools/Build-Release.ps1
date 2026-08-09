param(
    [string]$OutputRoot,
    [switch]$SkipArchive
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Metadata = Get-Content (Join-Path $Root 'version.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$ReleaseRules = Get-Content (Join-Path $Root 'release-files.json') -Raw -Encoding UTF8 | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $Root 'artifacts'
}

$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$Stage = Join-Path $OutputRoot ("DriveOS-{0}" -f $Metadata.version)
$Archive = "$Stage.zip"

if (Test-Path $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
if (Test-Path $Archive) { Remove-Item -LiteralPath $Archive -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

function Test-ReleasePattern {
    param([string]$Path, [string]$Pattern)
    $normalized = $Path.Replace('\', '/')
    $candidate = $Pattern.Replace('**', '*')
    return $normalized -like $candidate
}

$Candidates = @(& git -C $Root ls-files --cached --others --exclude-standard) |
    ForEach-Object { $_.Replace('\', '/') } |
    Where-Object {
        $path = $_
        ($ReleaseRules.include | Where-Object { Test-ReleasePattern $path $_ }).Count -gt 0 -and
        ($ReleaseRules.exclude | Where-Object { Test-ReleasePattern $path $_ }).Count -eq 0 -and
        ($ReleaseRules.forbidden | Where-Object { Test-ReleasePattern $path $_ }).Count -eq 0
    } |
    Sort-Object -Unique

foreach ($RelativePath in $Candidates) {
    $Source = Join-Path $Root $RelativePath
    if (-not (Test-Path $Source -PathType Leaf)) { continue }
    $Destination = Join-Path $Stage $RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

$Csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$DesktopSources = @(Get-ChildItem (Join-Path $Stage 'desktop') -Filter '*.cs' -File | Sort-Object Name)
$CompilerArguments = @(
    '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/checked+', '/warn:4',
    "/win32icon:`"$(Join-Path $Stage 'DriveOS-v4.ico')`"",
    "/out:`"$(Join-Path $Stage 'DriveOS.exe')`"",
    '/reference:System.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    "/reference:`"$(Join-Path $Stage 'Microsoft.Web.WebView2.Core.dll')`"",
    "/reference:`"$(Join-Path $Stage 'Microsoft.Web.WebView2.WinForms.dll')`""
)
$CompilerArguments += @($DesktopSources | ForEach-Object { "`"$($_.FullName)`"" })

& $Csc @CompilerArguments
$CompileExitCode = $LASTEXITCODE
if ($CompileExitCode -ne 0 -or -not (Test-Path (Join-Path $Stage 'DriveOS.exe'))) {
    throw "Desktop release build failed with compiler exit code $CompileExitCode."
}

$Files = @(Get-ChildItem $Stage -Recurse -File | Sort-Object { $_.FullName.Substring($Stage.Length) })
$Checksums = @($Files | ForEach-Object {
    [ordered]@{
        path = $_.FullName.Substring($Stage.Length + 1).Replace('\', '/')
        bytes = $_.Length
        sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
})

$ArtifactManifest = [ordered]@{
    schemaVersion = 1
    product = $Metadata.product
    version = $Metadata.version
    build = $Metadata.webBuild
    files = $Checksums
}
$ArtifactManifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Stage 'artifact-manifest.json') -Encoding UTF8

if (-not $SkipArchive) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $ArchiveStream = [IO.File]::Open($Archive, [IO.FileMode]::CreateNew)
    try {
        $Zip = New-Object IO.Compression.ZipArchive($ArchiveStream, [IO.Compression.ZipArchiveMode]::Create)
        try {
            Get-ChildItem $Stage -Recurse -File |
                Sort-Object { $_.FullName.Substring($Stage.Length) } |
                ForEach-Object {
                    $RelativePath = $_.FullName.Substring($Stage.Length + 1).Replace('\', '/')
                    $Entry = $Zip.CreateEntry($RelativePath, [IO.Compression.CompressionLevel]::Optimal)
                    $Entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
                    $Input = [IO.File]::OpenRead($_.FullName)
                    $Output = $Entry.Open()
                    try { $Input.CopyTo($Output) } finally { $Output.Dispose(); $Input.Dispose() }
                }
        } finally { $Zip.Dispose() }
    } finally { $ArchiveStream.Dispose() }
}

Write-Host "DriveOS $($Metadata.version) release staged at $Stage" -ForegroundColor Green
if (-not $SkipArchive) { Write-Host "Release archive: $Archive" -ForegroundColor Green }
