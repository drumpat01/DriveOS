$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ModulePath = Join-Path `
    $Root `
    "src\Security\DriveOS.SecretProtection.psm1"

function Assert-True {
    param([bool]$Condition,[string]$Message)
    if (-not $Condition) { throw $Message }
}

Import-Module $ModulePath -Force

$Key = New-Object byte[] 32
$Random = [Security.Cryptography.RandomNumberGenerator]::Create()

try {
    $Random.GetBytes($Key)
}
finally {
    $Random.Dispose()
}

$PlainText = "DriveOS secret test value"
$Protected = Protect-DriveOSSecret `
    -PlainText $PlainText `
    -Mode web `
    -EncryptionKey $Key

Assert-True `
    ($Protected -match '^webv1:') `
    "Web secret should use the versioned protected format."

Assert-True `
    ($Protected -notmatch [regex]::Escape($PlainText)) `
    "Protected web secret must not contain plaintext."

$RoundTrip = Unprotect-DriveOSSecret `
    -ProtectedText $Protected `
    -Mode web `
    -EncryptionKey $Key

Assert-True `
    ($RoundTrip -eq $PlainText) `
    "Web secret encryption round trip failed."

$Parts = $Protected.Split(':')
$Mac = [Convert]::FromBase64String($Parts[3])
$Mac[0] = $Mac[0] -bxor 1
$Parts[3] = [Convert]::ToBase64String($Mac)
$Tampered = $Parts -join ':'

$TamperRejected = $false

try {
    $null = Unprotect-DriveOSSecret `
        -ProtectedText $Tampered `
        -Mode web `
        -EncryptionKey $Key
}
catch {
    $TamperRejected = $true
}

Assert-True `
    $TamperRejected `
    "Tampered encrypted secrets must be rejected."

Write-Host `
    "DriveOS secret protection checks passed." `
    -ForegroundColor Green