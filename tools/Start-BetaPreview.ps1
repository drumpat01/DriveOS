param(
    [int]$LocalPort = 8791,
    [int]$HttpsPort = 8443,
    [string]$Upstream = "https://journeydeck.me"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ProxyScript = Join-Path $PSScriptRoot "beta-live-proxy.mjs"
$StateDir = Join-Path $env:LOCALAPPDATA "JourneyDeck\BetaPreview"
$PidFile = Join-Path $StateDir "server.pid"
$OutLog = Join-Path $StateDir "server.log"
$ErrorLog = Join-Path $StateDir "server-error.log"

function Find-Tailscale {
    $Command = Get-Command tailscale.exe -ErrorAction SilentlyContinue
    if ($Command) { return $Command.Source }
    $Candidate = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
    if (Test-Path -LiteralPath $Candidate -PathType Leaf) { return $Candidate }
    throw "Tailscale is not installed."
}

function Test-PreviewHealth {
    try {
        $Health = Invoke-RestMethod -Uri "http://127.0.0.1:$LocalPort/healthz" -TimeoutSec 2
        return $Health.ok -eq $true -and $Health.mode -eq "live-proxy"
    } catch { return $false }
}

if (-not (Test-Path -LiteralPath $ProxyScript -PathType Leaf)) { throw "Beta proxy not found: $ProxyScript" }
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw "Node.js is required for the beta preview." }

$Tailscale = Find-Tailscale
$Status = (& $Tailscale status --json 2>$null) | ConvertFrom-Json
if ($Status.BackendState -ne "Running" -or -not $Status.Self.Online) {
    throw "Tailscale is not connected. Open Tailscale and sign in, then run this again."
}

New-Item -ItemType Directory -Path $StateDir -Force | Out-Null

if (-not (Test-PreviewHealth)) {
    if (Test-Path -LiteralPath $PidFile) {
        $OldPid = [int](Get-Content -LiteralPath $PidFile -Raw)
        $OldProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$OldPid" -ErrorAction SilentlyContinue
        if ($OldProcess -and $OldProcess.CommandLine -like "*beta-live-proxy.mjs*") {
            Stop-Process -Id $OldPid -Force
        }
    }

    Remove-Item -LiteralPath $OutLog,$ErrorLog -Force -ErrorAction SilentlyContinue
    $PreviousPort = $env:DRIVEOS_BETA_PORT
    $PreviousHost = $env:DRIVEOS_BETA_HOST
    $PreviousUpstream = $env:DRIVEOS_BETA_UPSTREAM
    try {
        $env:DRIVEOS_BETA_PORT = "$LocalPort"
        $env:DRIVEOS_BETA_HOST = "127.0.0.1"
        $env:DRIVEOS_BETA_UPSTREAM = $Upstream
        $Process = Start-Process -FilePath (Get-Command node.exe).Source `
            -ArgumentList @("`"$ProxyScript`"") `
            -WorkingDirectory $Root `
            -WindowStyle Hidden `
            -RedirectStandardOutput $OutLog `
            -RedirectStandardError $ErrorLog `
            -PassThru
        Set-Content -LiteralPath $PidFile -Value $Process.Id -NoNewline
    } finally {
        $env:DRIVEOS_BETA_PORT = $PreviousPort
        $env:DRIVEOS_BETA_HOST = $PreviousHost
        $env:DRIVEOS_BETA_UPSTREAM = $PreviousUpstream
    }

    $Ready = $false
    foreach ($Attempt in 1..20) {
        Start-Sleep -Milliseconds 250
        if (Test-PreviewHealth) { $Ready = $true; break }
    }
    if (-not $Ready) {
        $Details = if (Test-Path $ErrorLog) { Get-Content $ErrorLog -Raw } else { "No error log was produced." }
        throw "JourneyDeck preview did not start. $Details"
    }
}

# Use a dedicated port so existing Tailscale Serve apps on HTTPS 443 remain untouched.
& $Tailscale serve --bg --yes --https=$HttpsPort $LocalPort | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Tailscale Serve could not expose the JourneyDeck preview." }

$DnsName = "$($Status.Self.DNSName)".Trim().TrimEnd(".")
$Url = "https://${DnsName}:$HttpsPort/?preview=local#dashboard"
$Info = [ordered]@{
    url = $Url
    localUrl = "http://127.0.0.1:$LocalPort"
    configuredAt = (Get-Date).ToString("o")
    pid = [int](Get-Content -LiteralPath $PidFile -Raw)
    mode = "Tailscale Serve (tailnet only)"
}
$Info | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $StateDir "preview.json") -Encoding utf8
try { Set-Clipboard -Value $Url } catch {}

Write-Host ""
Write-Host "JourneyDeck beta preview is ready:" -ForegroundColor Green
Write-Host $Url -ForegroundColor White
Write-Host ""
Write-Host "The URL is private to your Tailnet and has been copied to the clipboard." -ForegroundColor Cyan
Write-Host "Edits under web/ appear after refreshing Safari; no commit or deploy is required." -ForegroundColor DarkGray
