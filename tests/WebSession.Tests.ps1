$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$SessionModule = Join-Path `
    $Root `
    "src\Security\DriveOS.WebSession.psm1"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function New-TestSecret {
    $Bytes = New-Object byte[] 32
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($Bytes)
    }
    finally {
        $Random.Dispose()
    }

    return $Bytes
}

Import-Module $SessionModule -Force

$OwnerEmail = "owner@example.com"
$Secret = New-TestSecret
$WrongSecret = New-TestSecret

$Now = [DateTimeOffset]::Parse(
    "2026-08-10T23:00:00Z"
)

$Token = New-DriveOSWebSessionToken `
    -OwnerEmail $OwnerEmail `
    -AuthSecret $Secret `
    -SessionHours 24 `
    -Now $Now

Assert-True `
    ($Token -match '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') `
    "Session token has an unexpected format."

Assert-True `
    (Test-DriveOSWebSessionToken `
        -Token $Token `
        -OwnerEmail $OwnerEmail `
        -AuthSecret $Secret `
        -Now $Now.AddHours(1)) `
    "Valid session token should be accepted."

Assert-True `
    (-not (Test-DriveOSWebSessionToken `
        -Token $Token `
        -OwnerEmail "someone@example.com" `
        -AuthSecret $Secret `
        -Now $Now.AddHours(1))) `
    "Session token must be bound to the owner email."

Assert-True `
    (-not (Test-DriveOSWebSessionToken `
        -Token $Token `
        -OwnerEmail $OwnerEmail `
        -AuthSecret $WrongSecret `
        -Now $Now.AddHours(1))) `
    "Session token signed with another secret must be rejected."

Assert-True `
    (-not (Test-DriveOSWebSessionToken `
        -Token $Token `
        -OwnerEmail $OwnerEmail `
        -AuthSecret $Secret `
        -Now $Now.AddHours(25))) `
    "Expired sessions must be rejected."

$TokenParts = $Token.Split('.')
$TamperedSignature = $(if ($TokenParts[2].StartsWith("A")) { "B" } else { "A" }) + $TokenParts[2].Substring(1)
$TamperedToken = "$($TokenParts[0]).$($TokenParts[1]).$TamperedSignature"

Assert-True `
    (-not (Test-DriveOSWebSessionToken `
        -Token $TamperedToken `
        -OwnerEmail $OwnerEmail `
        -AuthSecret $Secret `
        -Now $Now.AddHours(1))) `
    "Tampered sessions must be rejected."

$Cookie = New-DriveOSWebSessionCookie `
    -Token $Token `
    -SessionHours 24

Assert-True `
    ($Cookie -match 'HttpOnly') `
    "Session cookie must be HttpOnly."

Assert-True `
    ($Cookie -match 'Secure') `
    "Session cookie must require HTTPS."

Assert-True `
    ($Cookie -match 'SameSite=Strict') `
    "Session cookie must use SameSite=Strict."

Assert-True `
    ($Cookie -match 'Max-Age=86400') `
    "Session cookie expiration is incorrect."

$ClearCookie = New-DriveOSWebSessionClearCookie

Assert-True `
    ($ClearCookie -match 'Max-Age=0') `
    "Logout cookie must immediately expire the session."

Write-Host `
    "DriveOS web session checks passed." `
    -ForegroundColor Green
