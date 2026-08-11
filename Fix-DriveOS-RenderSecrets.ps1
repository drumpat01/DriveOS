$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$RenderPath = Join-Path $Root "render.yaml"
$ToolPath = Join-Path $Root "tools\New-DriveOSWebSecrets.ps1"

if (-not (Test-Path $RenderPath -PathType Leaf)) {
    throw "Run this script from the DriveOS repository root."
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $Branch = (& git branch --show-current 2>$null).Trim()

    if ($Branch -and $Branch -ne "web-hosting-prep") {
        throw "This patch must be applied on web-hosting-prep. Current branch: $Branch"
    }

    $Changes = @(& git status --porcelain 2>$null)

    if ($Changes.Count -gt 0) {
        throw "Your Git working tree has uncommitted changes. Commit or stash them first."
    }
}

$Render = [IO.File]::ReadAllText($RenderPath) -replace "`r`n", "`n"

$Old = @'
      - key: DRIVEOS_AUTH_SECRET
        generateValue: true
      - key: DRIVEOS_ENCRYPTION_KEY
        generateValue: true
'@

$New = @'
      - key: DRIVEOS_AUTH_SECRET
        sync: false
      - key: DRIVEOS_ENCRYPTION_KEY
        sync: false
'@

if (-not $Render.Contains($Old)) {
    throw "Expected Render secret-generation block was not found."
}

$Render = $Render.Replace($Old, $New)

$Tool = @'
$ErrorActionPreference = "Stop"

function New-DriveOSRandomBase64Secret {
    param([int]$Bytes = 32)

    $Buffer = New-Object byte[] $Bytes
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($Buffer)
    }
    finally {
        $Random.Dispose()
    }

    return [Convert]::ToBase64String($Buffer)
}

Write-Host ""
Write-Host "Generate these values once and store them only in your hosting environment." -ForegroundColor Cyan
Write-Host "Do not commit them to GitHub." -ForegroundColor Yellow
Write-Host ""
Write-Host "DRIVEOS_AUTH_SECRET="
Write-Host (New-DriveOSRandomBase64Secret -Bytes 32)
Write-Host ""
Write-Host "DRIVEOS_ENCRYPTION_KEY="
Write-Host (New-DriveOSRandomBase64Secret -Bytes 32)
Write-Host ""
'@

$Encoding = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($RenderPath, $Render, $Encoding)

$Directory = Split-Path -Parent $ToolPath
if (-not (Test-Path $Directory)) {
    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
}

[IO.File]::WriteAllText($ToolPath, $Tool, $Encoding)

Write-Host ""
Write-Host "Render secret configuration corrected." -ForegroundColor Green
Write-Host "Run .\tools\New-DriveOSWebSecrets.ps1 when you're ready to enter the two private values into Render."
