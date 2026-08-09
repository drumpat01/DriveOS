$ErrorActionPreference = "Stop"

$InstallDir = Split-Path -Parent $PSScriptRoot
$DataDir = Join-Path $InstallDir "data"
$DriveOSExe = Join-Path $InstallDir "DriveOS.exe"

function Is-Administrator {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($Identity)
    return $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    try {
        $Machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $User = [Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$Machine;$User"
    } catch {}
}

function Find-Tailscale {
    Refresh-Path

    $Command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($Command) { return $Command.Source }

    foreach ($Candidate in @(
        "$env:ProgramFiles\Tailscale\tailscale.exe",
        "${env:ProgramFiles(x86)}\Tailscale\tailscale.exe"
    )) {
        if ($Candidate -and (Test-Path $Candidate -PathType Leaf)) {
            return $Candidate
        }
    }

    return $null
}

if (-not (Is-Administrator)) {
    Start-Process powershell.exe `
        -Verb RunAs `
        -ArgumentList @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", ('"' + $PSCommandPath + '"')
        )
    exit 0
}

$Tailscale = Find-Tailscale

if (-not $Tailscale) {
    Write-Host ""
    Write-Host "Tailscale is not installed. Installing the official Windows package..." -ForegroundColor Cyan
    Write-Host ""

    $Winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $Winget) {
        throw "Windows Package Manager (winget) was not found."
    }

    & $Winget.Source install `
        --id Tailscale.Tailscale `
        --exact `
        --accept-package-agreements `
        --accept-source-agreements

    if ($LASTEXITCODE -ne 0) {
        throw "Tailscale installation failed with exit code $LASTEXITCODE."
    }

    Start-Sleep -Seconds 2
    $Tailscale = Find-Tailscale
}

if (-not $Tailscale) {
    throw "Tailscale was installed but tailscale.exe could not be located."
}

try {
    Start-Service Tailscale -ErrorAction SilentlyContinue
} catch {}

Write-Host ""
Write-Host "Checking Tailscale sign-in..." -ForegroundColor Cyan

$Status = $null
try {
    $Status = (& $Tailscale status --json 2>$null) | ConvertFrom-Json
} catch {}

if (-not $Status -or -not $Status.Self -or -not $Status.Self.DNSName) {
    Write-Host ""
    Write-Host "Tailscale needs you to sign in. A browser authorization page may open." -ForegroundColor Yellow
    Write-Host ""

    & $Tailscale up

    if ($LASTEXITCODE -ne 0) {
        throw "Tailscale sign-in did not complete."
    }

    Start-Sleep -Seconds 2
    $Status = (& $Tailscale status --json 2>$null) | ConvertFrom-Json
}

if (-not $Status.Self -or -not $Status.Self.DNSName) {
    throw "This PC still does not have a Tailscale MagicDNS name."
}

# Start DriveOS if necessary.
if (-not (Get-Process -Name DriveOS -ErrorAction SilentlyContinue) -and
    (Test-Path $DriveOSExe -PathType Leaf)) {
    Start-Process -FilePath $DriveOSExe -WorkingDirectory $InstallDir
    Start-Sleep -Seconds 4
}

Write-Host ""
Write-Host "Enabling private HTTPS phone access..." -ForegroundColor Cyan

# Tailnet-only. Do NOT use Funnel.
& $Tailscale serve --bg 8787
if ($LASTEXITCODE -ne 0) {
    throw "Tailscale Serve could not be enabled. If a browser consent page opened for HTTPS, approve it and run ENABLE-PHONE-ACCESS.bat again."
}

$DnsName = "$($Status.Self.DNSName)".Trim().TrimEnd(".")
$Url = "https://$DnsName"

New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Info = @(
    "DriveOS 3.1 phone access",
    "URL: $Url",
    "Configured: $((Get-Date).ToString('o'))",
    "Mode: Tailscale Serve (tailnet only)",
    "Target: http://127.0.0.1:8787"
) -join "`r`n"

[System.IO.File]::WriteAllText(
    (Join-Path $DataDir "phone-access.txt"),
    ($Info + "`r`n"),
    $Utf8NoBom
)

try { Set-Clipboard -Value $Url } catch {}

# Start DriveOS automatically after Windows login so phone access is available
# whenever this user is signed in and the computer is awake.
try {
    $Startup = [Environment]::GetFolderPath("Startup")
    $Link = Join-Path $Startup "DriveOS.lnk"
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($Link)
    $Shortcut.TargetPath = $DriveOSExe
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.IconLocation = "$(Join-Path $InstallDir 'DriveOS-v4.ico'),0"
    $Shortcut.Description = "Start DriveOS for private phone access"
    $Shortcut.Save()
} catch {}

try {
    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
    [System.Windows.MessageBox]::Show(
        "DriveOS phone access is ready.`n`n$Url`n`nThe URL has been copied to your clipboard.`n`nOn your iPhone:`n1. Install/open Tailscale and sign into the SAME account/tailnet.`n2. Open this HTTPS URL in Safari.`n3. Tap Share -> Add to Home Screen.`n4. Launch DriveOS from the new Home Screen icon.`n`nDriveOS is private to your Tailscale network. Funnel is not enabled.`n`nYour desktop must be awake and DriveOS must be running.",
        "DriveOS 3.1 Phone Access Ready",
        "OK",
        "Information"
    ) | Out-Null
} catch {}

Write-Host ""
Write-Host "DriveOS phone URL:" -ForegroundColor Green
Write-Host $Url -ForegroundColor White
Write-Host ""
Write-Host "The URL was copied to your clipboard." -ForegroundColor Green
Write-Host "This is Tailscale Serve only; it is not public." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to close"
