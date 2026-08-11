$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$TursoModulePath = Join-Path $Root "src\Storage\DriveOS.Turso.psm1"
$RepositoryModulePath = Join-Path $Root "src\Repositories\DriveOS.Repository.psm1"

function Assert-True {
    param([bool]$Condition,[string]$Message)

    if (-not $Condition) {
        throw $Message
    }
}

Import-Module $TursoModulePath -Force
Import-Module $RepositoryModulePath -Force

$HttpUrl = Get-DriveOSTursoHttpUrl `
    -DatabaseUrl "libsql://driveos-example.turso.io"

Assert-True `
    ($HttpUrl -eq "https://driveos-example.turso.io") `
    "Turso libsql URL should convert to HTTPS."

$BadUrlRejected = $false

try {
    $null = Get-DriveOSTursoHttpUrl -DatabaseUrl "https://evil.example.com"
}
catch {
    $BadUrlRejected = $true
}

Assert-True $BadUrlRejected "Unexpected Turso URL formats must be rejected."

$OldProvider = $env:DRIVEOS_REPOSITORY_PROVIDER
$OldUrl = $env:TURSO_DATABASE_URL
$OldToken = $env:TURSO_AUTH_TOKEN

try {
    $env:DRIVEOS_REPOSITORY_PROVIDER = "Turso"
    $env:TURSO_DATABASE_URL = "libsql://driveos-example.turso.io"
    $env:TURSO_AUTH_TOKEN = "test-token"

    $Repository = New-DriveOSRepository `
        -DataDirectory (Join-Path $env:TEMP "driveos-turso-test")

    Assert-True ($Repository.Provider -eq "Turso") "Repository provider should support Turso."
    Assert-True ($Repository.TursoDatabaseUrl -eq $env:TURSO_DATABASE_URL) "Turso database URL should be retained."
    Assert-True ($Repository.TursoAuthToken -eq "test-token") "Turso auth token should load from environment."
}
finally {
    $env:DRIVEOS_REPOSITORY_PROVIDER = $OldProvider
    $env:TURSO_DATABASE_URL = $OldUrl
    $env:TURSO_AUTH_TOKEN = $OldToken
}

$Source = Get-Content $TursoModulePath -Raw

Assert-True ($Source -match '/v2/pipeline') "Turso storage must use SQL-over-HTTP."
Assert-True ($Source -match 'Authorization\s*=\s*"Bearer') "Turso requests must use Bearer auth."
Assert-True ($Source -match 'CREATE TABLE IF NOT EXISTS app_state') "Turso must persist app state."

Write-Host "DriveOS Turso checks passed." -ForegroundColor Green