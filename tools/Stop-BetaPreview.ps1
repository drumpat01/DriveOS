param([int]$HttpsPort = 8443)

$ErrorActionPreference = "Stop"
$StateDir = Join-Path $env:LOCALAPPDATA "JourneyDeck\BetaPreview"
$PidFile = Join-Path $StateDir "server.pid"
$Tailscale = (Get-Command tailscale.exe -ErrorAction Stop).Source

# Remove only JourneyDeck's dedicated Serve listener; preserve all other apps.
& $Tailscale serve --https=$HttpsPort off | Out-Null

if (Test-Path -LiteralPath $PidFile) {
    $PreviewPid = [int](Get-Content -LiteralPath $PidFile -Raw)
    $Process = Get-CimInstance Win32_Process -Filter "ProcessId=$PreviewPid" -ErrorAction SilentlyContinue
    if ($Process -and $Process.CommandLine -like "*beta-live-proxy.mjs*") {
        Stop-Process -Id $PreviewPid -Force
    }
    Remove-Item -LiteralPath $PidFile -Force
}

Write-Host "JourneyDeck beta preview stopped. Other Tailscale services were not changed." -ForegroundColor Green
