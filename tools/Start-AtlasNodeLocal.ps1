param(
    [int]$Port = 8791,
    [string]$Database = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data\atlas-node-dev\journeydeck-local.db'),
    [string]$LegacyReadOnlyUpstream = 'https://journeydeck.me'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AllowedRoot = [IO.Path]::GetFullPath((Join-Path $Root 'data\atlas-node-dev'))
$ResolvedDatabase = [IO.Path]::GetFullPath($Database)
if (-not $ResolvedDatabase.StartsWith($AllowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'The runtime database must remain inside data\atlas-node-dev.' }
if (-not (Test-Path -LiteralPath $ResolvedDatabase -PathType Leaf)) { throw 'The local Atlas database is missing. Run tools\New-AtlasNodeDevelopmentSnapshot.ps1 first.' }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port already has a listener. Stop the prior local preview before starting Node." }

Push-Location $Root
try { & npm run build:server; if ($LASTEXITCODE -ne 0) { throw 'The TypeScript build failed.' } }
finally { Pop-Location }

$LogDirectory = Join-Path $Root 'logs\atlas-node-local'
[IO.Directory]::CreateDirectory($LogDirectory) | Out-Null
$PidPath = Join-Path $AllowedRoot 'node.pid'
$Node = (Get-Command node -ErrorAction Stop).Source
$Environment = @{
    DRIVEOS_NODE_HOST = '127.0.0.1'
    DRIVEOS_NODE_PORT = "$Port"
    DRIVEOS_NODE_DATABASE = $ResolvedDatabase
    DRIVEOS_NODE_LEGACY_UPSTREAM = $LegacyReadOnlyUpstream
    DRIVEOS_NODE_LEGACY_READ_ONLY = 'true'
    DRIVEOS_NODE_PUBLIC_ORIGIN = 'https://superredux.tail1babbd.ts.net:8443'
    DRIVEOS_NODE_LOG_LEVEL = 'info'
    DRIVEOS_NODE_TRUST_TAILSCALE_HEADERS = 'true'
}
$Process = Start-Process -FilePath $Node -ArgumentList @('server\dist\index.js') -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $LogDirectory 'stdout.log') -RedirectStandardError (Join-Path $LogDirectory 'stderr.log') -Environment $Environment -PassThru
[IO.File]::WriteAllText($PidPath, "$($Process.Id)", [Text.UTF8Encoding]::new($false))
try {
    $Healthy = $false
    for ($Attempt = 1; $Attempt -le 40; $Attempt++) { Start-Sleep -Milliseconds 100; try { $Health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 2; if ($Health.ok -and $Health.mode -eq 'node-hybrid') { $Healthy = $true; break } } catch {} }
    if (-not $Healthy) { throw 'The Node service did not become healthy.' }
    [pscustomobject]@{ ok = $true; pid = $Process.Id; port = $Port; mode = $Health.mode; database = 'isolated-local-sqlite'; legacyCompatibility = 'explicit-read-only' }
}
catch { if (-not $Process.HasExited) { Stop-Process -Id $Process.Id -Force }; Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue; throw }
