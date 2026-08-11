$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$AuthModule = Join-Path $Root "src\Security\DriveOS.WebAuth.psm1"

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

$OriginalOwnerEmail = $env:DRIVEOS_OWNER_EMAIL
$OriginalPasswordHash = $env:DRIVEOS_PASSWORD_HASH
$OriginalAuthSecret = $env:DRIVEOS_AUTH_SECRET
$OriginalEncryptionKey = $env:DRIVEOS_ENCRYPTION_KEY

try {
    Import-Module $AuthModule -Force

    # --------------------------------------------------------
    # Password hashing and verification.
    # --------------------------------------------------------

    $CorrectPassword = ConvertTo-SecureString `
        "DriveOS-Test-Password-2026!" `
        -AsPlainText `
        -Force

    $WrongPassword = ConvertTo-SecureString `
        "Definitely-The-Wrong-Password!" `
        -AsPlainText `
        -Force

    $Hash = New-DriveOSPasswordHash -Password $CorrectPassword

    Assert-True `
        ($Hash -match '^pbkdf2-sha256\$600000\$') `
        "Generated password hash has an unexpected format."

    Assert-True `
        (Test-DriveOSPassword -Password $CorrectPassword -StoredHash $Hash) `
        "Correct password should validate successfully."

    Assert-True `
        (-not (Test-DriveOSPassword -Password $WrongPassword -StoredHash $Hash)) `
        "Wrong password must be rejected."

    Assert-True `
        (-not (Test-DriveOSPassword -Password $CorrectPassword -StoredHash "not-a-valid-hash")) `
        "Malformed password hashes must be rejected."

    # --------------------------------------------------------
    # Weak passwords.
    # --------------------------------------------------------

    $WeakPassword = ConvertTo-SecureString `
        "short" `
        -AsPlainText `
        -Force

    $WeakPasswordRejected = $false

    try {
        $null = New-DriveOSPasswordHash -Password $WeakPassword
    }
    catch {
        $WeakPasswordRejected = $true
    }

    Assert-True `
        $WeakPasswordRejected `
        "Passwords shorter than 12 characters must be rejected."

    # --------------------------------------------------------
    # Valid web authentication configuration.
    # --------------------------------------------------------

    $env:DRIVEOS_OWNER_EMAIL = "owner@example.com"
    $env:DRIVEOS_PASSWORD_HASH = $Hash
    $env:DRIVEOS_AUTH_SECRET = New-TestSecret -Bytes 32
    $env:DRIVEOS_ENCRYPTION_KEY = New-TestSecret -Bytes 32

    $Config = Get-DriveOSWebAuthConfiguration `
        -PublicUrl "https://driveos.example.com"

    Assert-True `
        ($Config.OwnerEmail -eq "owner@example.com") `
        "Owner email was not loaded correctly."

    Assert-True `
        ($Config.PublicUrl -eq "https://driveos.example.com") `
        "Public URL was not loaded correctly."

    Assert-True `
        ($Config.AuthSecret.Length -ge 32) `
        "Authentication secret was not decoded correctly."

    Assert-True `
        ($Config.EncryptionKey.Length -eq 32) `
        "Encryption key was not decoded correctly."

    # --------------------------------------------------------
    # Missing required configuration must fail closed.
    # --------------------------------------------------------

    Remove-Item Env:DRIVEOS_OWNER_EMAIL -ErrorAction SilentlyContinue

    $MissingOwnerRejected = $false

    try {
        $null = Get-DriveOSWebAuthConfiguration `
            -PublicUrl "https://driveos.example.com"
    }
    catch {
        $MissingOwnerRejected = $true
    }

    Assert-True `
        $MissingOwnerRejected `
        "Missing owner email must prevent web authentication startup."

    $env:DRIVEOS_OWNER_EMAIL = "owner@example.com"
    Remove-Item Env:DRIVEOS_AUTH_SECRET -ErrorAction SilentlyContinue

    $MissingSecretRejected = $false

    try {
        $null = Get-DriveOSWebAuthConfiguration `
            -PublicUrl "https://driveos.example.com"
    }
    catch {
        $MissingSecretRejected = $true
    }

    Assert-True `
        $MissingSecretRejected `
        "Missing authentication secret must prevent web authentication startup."

    Write-Host `
        "DriveOS web authentication checks passed." `
        -ForegroundColor Green
}
finally {
    $env:DRIVEOS_OWNER_EMAIL = $OriginalOwnerEmail
    $env:DRIVEOS_PASSWORD_HASH = $OriginalPasswordHash
    $env:DRIVEOS_AUTH_SECRET = $OriginalAuthSecret
    $env:DRIVEOS_ENCRYPTION_KEY = $OriginalEncryptionKey
}