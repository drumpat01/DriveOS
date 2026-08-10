$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

$Server = Get-Content `
    (Join-Path $Root "DriveOS-Server.ps1") `
    -Raw

$Config = Get-Content `
    (Join-Path $Root "src\Configuration\DriveOS.Configuration.psm1") `
    -Raw

$Repository = Get-Content `
    (Join-Path $Root "src\Repositories\DriveOS.Repository.psm1") `
    -Raw

$App = Get-Content `
    (Join-Path $Root "web\app.js") `
    -Raw

Assert-True `
    (Test-Path (Join-Path $Root "Dockerfile")) `
    "Dockerfile is missing."

Assert-True `
    (Test-Path (Join-Path $Root "render.yaml")) `
    "Render Blueprint is missing."

Assert-True `
    ($Config -match 'RENDER_EXTERNAL_URL') `
    "Render public URL fallback is missing."

Assert-True `
    ($Repository -match 'Get-Command sqlite3') `
    "Linux SQLite executable discovery is missing."

Assert-True `
    ($Server -match 'Initialize-DriveOSSqlite') `
    "Web SQLite initialization is missing."

Assert-True `
    ($Server -match 'Start-SpotifyWebAuthorization') `
    "Hosted Spotify authorization is missing."

Assert-True `
    ($Server -match 'Complete-SpotifyWebAuthorization') `
    "Hosted Spotify OAuth callback is missing."

Assert-True `
    ($Server -match '/auth/spotify/callback') `
    "Hosted Spotify callback route is missing."

Assert-True `
    ($Server -match 'code_challenge_method=S256') `
    "Spotify PKCE S256 challenge is missing."

Assert-True `
    ($Server -match 'code_verifier') `
    "Spotify PKCE verifier exchange is missing."

Assert-True `
    ($App -match 'authorizationUrl') `
    "Browser Spotify redirect handling is missing."

$Render = Get-Content `
    (Join-Path $Root "render.yaml") `
    -Raw

Assert-True `
    ($Render -match 'healthCheckPath:\s*/healthz') `
    "Render health check is not configured."

Assert-True `
    ($Render -match 'mountPath:\s*/app/data') `
    "Render persistent data disk is not configured."

Assert-True `
    ($Render -match 'DRIVEOS_PASSWORD_HASH[\s\S]{0,80}sync:\s*false') `
    "Password hash must remain a private Render environment value."

Assert-True `
    ($Render -match 'DRIVEOS_AUTH_SECRET[\s\S]{0,80}generateValue:\s*true') `
    "Render must generate the authentication secret."

Assert-True `
    ($Render -match 'DRIVEOS_ENCRYPTION_KEY[\s\S]{0,80}generateValue:\s*true') `
    "Render must generate the encryption key."

Write-Host `
    "DriveOS web deployment checks passed." `
    -ForegroundColor Green