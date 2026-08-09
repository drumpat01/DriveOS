$ErrorActionPreference = "Stop"

function Find-Tailscale {
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

$Tailscale = Find-Tailscale
if (-not $Tailscale) {
    throw "Tailscale was not found."
}

& $Tailscale serve --https=443 off
if ($LASTEXITCODE -ne 0) {
    throw "Tailscale Serve could not be disabled."
}

Remove-Item (Join-Path (Split-Path -Parent $PSScriptRoot) "data\phone-access.txt") -Force -ErrorAction SilentlyContinue

try {
    $Startup = [Environment]::GetFolderPath("Startup")
    Remove-Item (Join-Path $Startup "DriveOS.lnk") -Force -ErrorAction SilentlyContinue
} catch {}

Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
[System.Windows.MessageBox]::Show(
    "DriveOS phone access has been disabled on this PC.",
    "DriveOS Phone Access",
    "OK",
    "Information"
) | Out-Null
