param(
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$DesktopSource = Join-Path $Root "desktop\Program.cs"
$IconPath = Join-Path $Root "DriveOS-v4.ico"
$OutputExe = Join-Path $Root "DriveOS.exe"

$PackageVersion = "1.0.4129.50"
$PackageRoot = Join-Path $Root "desktop\packages"
$Nupkg = Join-Path $PackageRoot "Microsoft.Web.WebView2.$PackageVersion.nupkg"
$Extracted = Join-Path $PackageRoot "Microsoft.Web.WebView2.$PackageVersion"

$CoreDll = Join-Path $Extracted "lib\net462\Microsoft.Web.WebView2.Core.dll"
$WinFormsDll = Join-Path $Extracted "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$LoaderDll = Join-Path $Extracted "runtimes\win-x64\native\WebView2Loader.dll"

$Csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

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
    Fail-DriveOSInstall "DriveOS 3.0.1 currently targets 64-bit Windows."
}

if (-not (Test-Path $Csc)) {
    Fail-DriveOSInstall "The Windows .NET Framework C# compiler was not found at: $Csc"
}

if (-not (Test-Path $DesktopSource)) {
    Fail-DriveOSInstall "desktop\Program.cs is missing."
}

if (-not (Test-Path $IconPath)) {
    Fail-DriveOSInstall "DriveOS-v4.ico is missing."
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

Write-Host "Building DriveOS.exe..." -ForegroundColor Cyan

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
    "/reference:`"$WinFormsDll`"",
    "`"$DesktopSource`""
)

$Compile = Start-Process `
    -FilePath $Csc `
    -ArgumentList $Arguments `
    -WorkingDirectory $Root `
    -Wait `
    -PassThru `
    -NoNewWindow

if ($Compile.ExitCode -ne 0 -or -not (Test-Path $OutputExe)) {
    Fail-DriveOSInstall "The C# compiler returned exit code $($Compile.ExitCode)."
}

Copy-Item $CoreDll (Join-Path $Root "Microsoft.Web.WebView2.Core.dll") -Force
Copy-Item $WinFormsDll (Join-Path $Root "Microsoft.Web.WebView2.WinForms.dll") -Force
Copy-Item $LoaderDll (Join-Path $Root "WebView2Loader.dll") -Force

Write-Host "Creating DriveOS desktop shortcut..." -ForegroundColor Cyan

$ShortcutUpdater = Join-Path $Root "Update-Desktop-Shortcut.ps1"

& powershell.exe `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $ShortcutUpdater `
    -NoPause

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "               DRIVEOS 3.0.1 INSTALLED                " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "DriveOS 3.0.1 was built successfully." -ForegroundColor Cyan
Write-Host ""
Write-Host "From now on, use the DriveOS desktop icon." -ForegroundColor Cyan
Write-Host "It opens a normal Windows application window." -ForegroundColor Cyan
Write-Host ""
Write-Host "No Chrome window. No Edge app window. No PowerShell window." -ForegroundColor Green
Write-Host ""
if (-not $NoPause) { Read-Host "Press Enter to close" }
