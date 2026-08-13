Set-StrictMode -Version 2.0

$script:DriveOSPasswordAlgorithm = "pbkdf2-sha256"
$script:DriveOSPasswordIterations = 600000
$script:DriveOSPasswordSaltBytes = 16
$script:DriveOSPasswordHashBytes = 32

function ConvertFrom-DriveOSBase64 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    try {
        return [Convert]::FromBase64String($Value)
    }
    catch {
        throw "$Name must be valid Base64."
    }
}

function Test-DriveOSFixedTimeBytes {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Left,
        [Parameter(Mandatory = $true)]
        [byte[]]$Right
    )

    if ($Left.Length -ne $Right.Length) {
        return $false
    }

    $Difference = 0

    for ($Index = 0; $Index -lt $Left.Length; $Index++) {
        $Difference = $Difference -bor ($Left[$Index] -bxor $Right[$Index])
    }

    return ($Difference -eq 0)
}

function Invoke-DriveOSPbkdf2 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Password,
        [Parameter(Mandatory = $true)]
        [byte[]]$Salt,
        [Parameter(Mandatory = $true)]
        [int]$Iterations,
        [Parameter(Mandatory = $true)]
        [int]$Length
    )

    $Deriver = New-Object `
        System.Security.Cryptography.Rfc2898DeriveBytes(
            $Password,
            $Salt,
            $Iterations,
            [System.Security.Cryptography.HashAlgorithmName]::SHA256
        )

    try {
        return $Deriver.GetBytes($Length)
    }
    finally {
        $Deriver.Dispose()
    }
}

function New-DriveOSPasswordHash {
    param(
        [Parameter(Mandatory = $true)]
        [Security.SecureString]$Password
    )

    $Pointer = [IntPtr]::Zero

    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $PlainText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)

        if (-not $PlainText -or $PlainText.Length -lt 12) {
            throw "DriveOS web password must contain at least 12 characters."
        }

        $Salt = New-Object byte[] $script:DriveOSPasswordSaltBytes
        $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

        try {
            $Random.GetBytes($Salt)
        }
        finally {
            $Random.Dispose()
        }

        $Hash = Invoke-DriveOSPbkdf2 `
            -Password $PlainText `
            -Salt $Salt `
            -Iterations $script:DriveOSPasswordIterations `
            -Length $script:DriveOSPasswordHashBytes

        return "{0}`${1}`${2}`${3}" -f `
            $script:DriveOSPasswordAlgorithm,
            $script:DriveOSPasswordIterations,
            [Convert]::ToBase64String($Salt),
            [Convert]::ToBase64String($Hash)
    }
    finally {
        if ($Pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
        }

        $PlainText = $null
    }
}

function Test-DriveOSPassword {
    param(
        [Parameter(Mandatory = $true)]
        [Security.SecureString]$Password,
        [Parameter(Mandatory = $true)]
        [string]$StoredHash
    )

    $Parts = $StoredHash.Split('$')

    if (
        $Parts.Count -ne 4 -or
        $Parts[0] -ne $script:DriveOSPasswordAlgorithm
    ) {
        return $false
    }

    $Iterations = 0

    if (
        -not [int]::TryParse($Parts[1], [ref]$Iterations) -or
        $Iterations -lt $script:DriveOSPasswordIterations
    ) {
        return $false
    }

    try {
        $Salt = [Convert]::FromBase64String($Parts[2])
        $ExpectedHash = [Convert]::FromBase64String($Parts[3])
    }
    catch {
        return $false
    }

    if (
        $Salt.Length -lt $script:DriveOSPasswordSaltBytes -or
        $ExpectedHash.Length -ne $script:DriveOSPasswordHashBytes
    ) {
        return $false
    }

    $Pointer = [IntPtr]::Zero

    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $PlainText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)

        $ActualHash = Invoke-DriveOSPbkdf2 `
            -Password $PlainText `
            -Salt $Salt `
            -Iterations $Iterations `
            -Length $ExpectedHash.Length

        return Test-DriveOSFixedTimeBytes `
            -Left $ActualHash `
            -Right $ExpectedHash
    }
    finally {
        if ($Pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
        }

        $PlainText = $null
    }
}

function Get-DriveOSWebAuthConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PublicUrl
    )

    $OwnerEmail = "$($env:DRIVEOS_OWNER_EMAIL)".Trim().ToLowerInvariant()
    $PasswordHash = "$($env:DRIVEOS_PASSWORD_HASH)".Trim()
    $WifeUsername = "$($env:DRIVEOS_WIFE_USERNAME)".Trim().ToLowerInvariant()
    $WifePasswordHash = "$($env:DRIVEOS_WIFE_PASSWORD_HASH)".Trim()
    $AuthSecretText = "$($env:DRIVEOS_AUTH_SECRET)".Trim()
    $EncryptionKeyText = "$($env:DRIVEOS_ENCRYPTION_KEY)".Trim()

    if (-not $PublicUrl) {
        throw "DRIVEOS_PUBLIC_URL is required in web mode."
    }

    if (-not $OwnerEmail) {
        throw "DRIVEOS_OWNER_EMAIL is required in web mode."
    }

    try {
        $ParsedEmail = New-Object System.Net.Mail.MailAddress($OwnerEmail)
    }
    catch {
        throw "DRIVEOS_OWNER_EMAIL must be a valid email address."
    }

    if ($ParsedEmail.Address.ToLowerInvariant() -ne $OwnerEmail) {
        throw "DRIVEOS_OWNER_EMAIL must contain one valid email address."
    }

    if (-not $PasswordHash) {
        throw "DRIVEOS_PASSWORD_HASH is required in web mode."
    }

    $HashParts = $PasswordHash.Split('$')

    if (
        $HashParts.Count -ne 4 -or
        $HashParts[0] -ne $script:DriveOSPasswordAlgorithm
    ) {
        throw "DRIVEOS_PASSWORD_HASH has an unsupported format."
    }

    $Iterations = 0

    if (
        -not [int]::TryParse($HashParts[1], [ref]$Iterations) -or
        $Iterations -lt $script:DriveOSPasswordIterations
    ) {
        throw "DRIVEOS_PASSWORD_HASH uses an insufficient work factor."
    }

    $null = ConvertFrom-DriveOSBase64 `
        -Value $HashParts[2] `
        -Name "DRIVEOS_PASSWORD_HASH salt"

    $StoredPasswordBytes = ConvertFrom-DriveOSBase64 `
        -Value $HashParts[3] `
        -Name "DRIVEOS_PASSWORD_HASH value"

    if ($StoredPasswordBytes.Length -ne $script:DriveOSPasswordHashBytes) {
        throw "DRIVEOS_PASSWORD_HASH has an invalid hash length."
    }

    if ([bool]$WifeUsername -xor [bool]$WifePasswordHash) {
        throw "DRIVEOS_WIFE_USERNAME and DRIVEOS_WIFE_PASSWORD_HASH must be configured together."
    }

    if ($WifeUsername) {
        if ($WifeUsername -notmatch '^[a-z0-9][a-z0-9._-]{2,63}$') {
            throw "DRIVEOS_WIFE_USERNAME must be 3-64 lowercase letters, numbers, dots, underscores, or hyphens."
        }

        $WifeHashParts = $WifePasswordHash.Split('$')
        if ($WifeHashParts.Count -ne 4 -or $WifeHashParts[0] -ne $script:DriveOSPasswordAlgorithm) {
            throw "DRIVEOS_WIFE_PASSWORD_HASH has an unsupported format."
        }

        $WifeIterations = 0
        if (-not [int]::TryParse($WifeHashParts[1], [ref]$WifeIterations) -or $WifeIterations -lt $script:DriveOSPasswordIterations) {
            throw "DRIVEOS_WIFE_PASSWORD_HASH uses an insufficient work factor."
        }

        $null = ConvertFrom-DriveOSBase64 -Value $WifeHashParts[2] -Name "DRIVEOS_WIFE_PASSWORD_HASH salt"
        $WifeStoredPasswordBytes = ConvertFrom-DriveOSBase64 -Value $WifeHashParts[3] -Name "DRIVEOS_WIFE_PASSWORD_HASH value"
        if ($WifeStoredPasswordBytes.Length -ne $script:DriveOSPasswordHashBytes) {
            throw "DRIVEOS_WIFE_PASSWORD_HASH has an invalid hash length."
        }
    }

    if (-not $AuthSecretText) {
        throw "DRIVEOS_AUTH_SECRET is required in web mode."
    }

    $AuthSecret = ConvertFrom-DriveOSBase64 `
        -Value $AuthSecretText `
        -Name "DRIVEOS_AUTH_SECRET"

    if ($AuthSecret.Length -lt 32) {
        throw "DRIVEOS_AUTH_SECRET must contain at least 32 random bytes."
    }

    if (-not $EncryptionKeyText) {
        throw "DRIVEOS_ENCRYPTION_KEY is required in web mode."
    }

    $EncryptionKey = ConvertFrom-DriveOSBase64 `
        -Value $EncryptionKeyText `
        -Name "DRIVEOS_ENCRYPTION_KEY"

    if ($EncryptionKey.Length -ne 32) {
        throw "DRIVEOS_ENCRYPTION_KEY must contain exactly 32 random bytes."
    }

    return [PSCustomObject]@{
        OwnerEmail    = $OwnerEmail
        PasswordHash  = $PasswordHash
        WifeUsername  = $WifeUsername
        WifePasswordHash = $WifePasswordHash
        AuthSecret    = $AuthSecret
        EncryptionKey = $EncryptionKey
        PublicUrl     = $PublicUrl.TrimEnd("/")
    }
}

Export-ModuleMember -Function `
    New-DriveOSPasswordHash, `
    Test-DriveOSPassword, `
    Get-DriveOSWebAuthConfiguration
