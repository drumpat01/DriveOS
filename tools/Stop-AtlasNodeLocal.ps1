$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$PidPath = Join-Path $Root 'data\atlas-node-dev\node.pid'
if (-not (Test-Path -LiteralPath $PidPath)) { Write-Output 'The local Atlas Node service is not recorded as running.'; return }
$ProcessId = [int](Get-Content -LiteralPath $PidPath -Raw)
$Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($Process) {
    $CommandLine = "$(Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" | Select-Object -ExpandProperty CommandLine)"
    if ($Process.ProcessName -notmatch '^node' -or $CommandLine -notmatch 'server[\\/]dist[\\/]index\.js') { throw 'The recorded PID is not the JourneyDeck Atlas Node service; it was not stopped.' }
    Stop-Process -Id $ProcessId
    $Process.WaitForExit(5000) | Out-Null
}
Remove-Item -LiteralPath $PidPath -Force
Write-Output 'The local Atlas Node service stopped.'
