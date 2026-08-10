$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ModulePath = Join-Path `
    $Root `
    "src\Security\DriveOS.WebRequest.psm1"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

Import-Module $ModulePath -Force

$PublicUrl = "https://driveos.example.com"

Assert-True `
    (Test-DriveOSWebHost `
        -HostHeader "driveos.example.com" `
        -PublicUrl $PublicUrl) `
    "Expected web Host should be accepted."

Assert-True `
    (-not (Test-DriveOSWebHost `
        -HostHeader "evil.example.com" `
        -PublicUrl $PublicUrl)) `
    "Unexpected web Host must be rejected."

$GoodHeaders = @{
    origin = "https://driveos.example.com"
    "sec-fetch-site" = "same-origin"
}

Assert-True `
    (Test-DriveOSWebOrigin `
        -Headers $GoodHeaders `
        -PublicUrl $PublicUrl) `
    "Same-origin POST should be accepted."

Assert-True `
    (-not (Test-DriveOSWebOrigin `
        -Headers @{
            origin = "https://evil.example.com"
            "sec-fetch-site" = "cross-site"
        } `
        -PublicUrl $PublicUrl)) `
    "Cross-site POST must be rejected."

Assert-True `
    (-not (Test-DriveOSWebOrigin `
        -Headers @{} `
        -PublicUrl $PublicUrl)) `
    "Web POST without Origin must be rejected."

$CookieHeaders = @{
    cookie = "theme=dark; DriveOSSession=abc123; other=value"
}

Assert-True `
    ((Get-DriveOSCookieValue `
        -Headers $CookieHeaders `
        -CookieName "DriveOSSession") -eq "abc123") `
    "DriveOS session cookie should be parsed."

Assert-True `
    ($null -eq (Get-DriveOSCookieValue `
        -Headers @{
            cookie = "DriveOSSession=first; DriveOSSession=second"
        } `
        -CookieName "DriveOSSession")) `
    "Duplicate DriveOS session cookies must be rejected."

Assert-True `
    (Test-DriveOSWebPublicRequest `
        -Method GET `
        -Path "/healthz") `
    "Health endpoint must be public."

Assert-True `
    (Test-DriveOSWebPublicRequest `
        -Method GET `
        -Path "/login") `
    "Login page must be public."

Assert-True `
    (Test-DriveOSWebPublicRequest `
        -Method POST `
        -Path "/api/auth/login") `
    "Login API must be public."

Assert-True `
    (-not (Test-DriveOSWebPublicRequest `
        -Method GET `
        -Path "/api/status")) `
    "DriveOS API status must require authentication."

$Key = "test-client"
$Now = [DateTimeOffset]::Parse("2026-08-10T23:00:00Z")

Assert-True `
    (Test-DriveOSLoginAllowed -ClientKey $Key -Now $Now) `
    "Fresh client should be allowed to attempt login."

1..5 | ForEach-Object {
    Register-DriveOSLoginFailure `
        -ClientKey $Key `
        -Now $Now
}

Assert-True `
    (-not (Test-DriveOSLoginAllowed `
        -ClientKey $Key `
        -Now $Now.AddSeconds(1))) `
    "Repeated login failures must trigger throttling."

Assert-True `
    (Test-DriveOSLoginAllowed `
        -ClientKey $Key `
        -Now $Now.AddSeconds(31)) `
    "Login throttling should expire."

Clear-DriveOSLoginFailures -ClientKey $Key

Write-Host `
    "DriveOS web request security checks passed." `
    -ForegroundColor Green