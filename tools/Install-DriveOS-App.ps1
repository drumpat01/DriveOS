param(
    [switch]$NoPause,
    [switch]$SkipShortcut,
    [switch]$SkipSqliteInstall,
    [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DesktopSources = @(Get-ChildItem (Join-Path $Root "desktop") -Filter "*.cs" -File |
    Sort-Object Name |
    ForEach-Object { $_.FullName })
$IconPath = Join-Path $Root "JourneyDeck.ico"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = $Root }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$OutputExe = Join-Path $OutputDirectory "DriveOS.exe"

$PackageVersion = "1.0.4129.50"
$PackageRoot = Join-Path $Root "desktop\packages"
$Nupkg = Join-Path $PackageRoot "Microsoft.Web.WebView2.$PackageVersion.nupkg"
$Extracted = Join-Path $PackageRoot "Microsoft.Web.WebView2.$PackageVersion"

$CoreDll = Join-Path $Extracted "lib\net462\Microsoft.Web.WebView2.Core.dll"
$WinFormsDll = Join-Path $Extracted "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$LoaderDll = Join-Path $Extracted "runtimes\win-x64\native\WebView2Loader.dll"

$Csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

& (Join-Path $PSScriptRoot "Sync-Version.ps1")
$DriveOSVersion = (Get-Content (Join-Path $Root "version.json") -Raw -Encoding UTF8 | ConvertFrom-Json).version
if (-not $SkipSqliteInstall) {
    & (Join-Path $PSScriptRoot "Install-Sqlite.ps1") | Out-Null
}

function Fail-DriveOSInstall {
    param([string]$Message)

    Write-Host ""
    Write-Host "DriveOS installation could not continue." -ForegroundColor Red
    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
    Write-Host ""
    if (-not $NoPause) { Read-Host "Press Enter to close" }
    exit 1
}

if (-not [Environment]::Is64BitOperatingSystem) {
    Fail-DriveOSInstall "DriveOS $DriveOSVersion currently targets 64-bit Windows."
}

if (-not (Test-Path $Csc)) {
    Fail-DriveOSInstall "The Windows .NET Framework C# compiler was not found at: $Csc"
}

if ($DesktopSources.Count -eq 0 -or -not (Test-Path (Join-Path $Root "desktop\Program.cs"))) {
    Fail-DriveOSInstall "DriveOS desktop sources are missing."
}

if (-not (Test-Path $IconPath)) {
    Fail-DriveOSInstall "JourneyDeck.ico is missing."
}

if (-not (Test-Path $PackageRoot)) {
    New-Item -ItemType Directory -Path $PackageRoot | Out-Null
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not (Test-Path $Nupkg)) {
    Write-Host ""
    Write-Host "Downloading Microsoft WebView2 SDK $PackageVersion from NuGet..." -ForegroundColor Cyan

    $NuGetUrl =
        "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/" +
        "$($PackageVersion.ToLowerInvariant())/" +
        "microsoft.web.webview2.$($PackageVersion.ToLowerInvariant()).nupkg"

    try {
        Invoke-WebRequest `
            -Uri $NuGetUrl `
            -OutFile $Nupkg `
            -UseBasicParsing
    }
    catch {
        Fail-DriveOSInstall (
            "The Microsoft WebView2 SDK could not be downloaded from NuGet.`n`n" +
            $_.Exception.Message
        )
    }
}

if (-not (Test-Path $Extracted)) {
    Write-Host "Extracting WebView2 SDK..." -ForegroundColor Cyan

    Add-Type -AssemblyName System.IO.Compression.FileSystem

    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory(
            $Nupkg,
            $Extracted
        )
    }
    catch {
        Fail-DriveOSInstall (
            "The WebView2 SDK package could not be extracted.`n`n" +
            $_.Exception.Message
        )
    }
}

foreach ($Required in @($CoreDll, $WinFormsDll, $LoaderDll)) {
    if (-not (Test-Path $Required)) {
        Fail-DriveOSInstall "Required WebView2 file was not found: $Required"
    }
}

# Reject an obviously malformed or unexpected package before compiling.
$PackageInfo = Get-Item $Nupkg

if ($PackageInfo.Length -lt 5000000 -or $PackageInfo.Length -gt 20000000) {
    Fail-DriveOSInstall "The downloaded WebView2 package size was outside the expected range."
}

$LoaderSignature = Get-AuthenticodeSignature -FilePath $LoaderDll

if ($LoaderSignature.Status -ne "Valid" -or
    -not $LoaderSignature.SignerCertificate -or
    $LoaderSignature.SignerCertificate.Subject -notlike "*Microsoft*") {
    Fail-DriveOSInstall "The native WebView2 loader did not have a valid Microsoft signature."
}

Write-Host "Building JourneyDeck..." -ForegroundColor Cyan

if (-not (Test-Path $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

$Arguments = @(
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/optimize+",
    "/checked+",
    "/warn:4",
    "/win32icon:`"$IconPath`"",
    "/out:`"$OutputExe`"",
    "/reference:System.dll",
    "/reference:System.Core.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    "/reference:`"$CoreDll`"",
    "/reference:`"$WinFormsDll`""
)

$Arguments += @($DesktopSources | ForEach-Object { "`"$_`"" })

& $Csc @Arguments
$CompileExitCode = $LASTEXITCODE

if ($CompileExitCode -ne 0 -or -not (Test-Path $OutputExe)) {
    Fail-DriveOSInstall "The C# compiler returned exit code $CompileExitCode."
}

Copy-Item $CoreDll (Join-Path $OutputDirectory "Microsoft.Web.WebView2.Core.dll") -Force
Copy-Item $WinFormsDll (Join-Path $OutputDirectory "Microsoft.Web.WebView2.WinForms.dll") -Force
Copy-Item $LoaderDll (Join-Path $OutputDirectory "WebView2Loader.dll") -Force
$OutputIcon = Join-Path $OutputDirectory "JourneyDeck.ico"
if (-not [String]::Equals(
        [IO.Path]::GetFullPath($IconPath),
        [IO.Path]::GetFullPath($OutputIcon),
        [StringComparison]::OrdinalIgnoreCase)) {
    Copy-Item $IconPath $OutputIcon -Force
}

if (-not $SkipShortcut) {
    Write-Host "Creating JourneyDeck desktop shortcut..." -ForegroundColor Cyan

    $ShortcutUpdater = Join-Path $Root "tools\Update-Desktop-Shortcut.ps1"

    & powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $ShortcutUpdater `
        -NoPause
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "             JOURNEYDECK $DriveOSVersion INSTALLED              " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "JourneyDeck $DriveOSVersion was built successfully." -ForegroundColor Cyan
Write-Host ""
Write-Host "From now on, use the JourneyDeck desktop icon." -ForegroundColor Cyan
Write-Host "It opens a normal Windows application window." -ForegroundColor Cyan
Write-Host ""
Write-Host "No Chrome window. No Edge app window. No PowerShell window." -ForegroundColor Green
Write-Host ""
if (-not $NoPause) { Read-Host "Press Enter to close" }
