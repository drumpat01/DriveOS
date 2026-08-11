Set-StrictMode -Version 2.0

function Test-DriveOSSecretFixedTimeBytes {
    param(
        [Parameter(Mandatory=$true)][byte[]]$Left,
        [Parameter(Mandatory=$true)][byte[]]$Right
    )

    if ($Left.Length -ne $Right.Length) {
        return $false
    }

    $Difference = 0

    for ($Index = 0; $Index -lt $Left.Length; $Index++) {
        $Difference = $Difference -bor (
            $Left[$Index] -bxor $Right[$Index]
        )
    }

    return ($Difference -eq 0)
}

function Get-DriveOSDerivedSecretKey {
    param(
        [Parameter(Mandatory=$true)][byte[]]$MasterKey,
        [Parameter(Mandatory=$true)][string]$Purpose
    )

    if ($MasterKey.Length -ne 32) {
        throw "DriveOS web encryption key must contain exactly 32 bytes."
    }

    $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MasterKey)

    try {
        return $Hmac.ComputeHash(
            [Text.Encoding]::UTF8.GetBytes(
                "DriveOS secret protection v1: $Purpose"
            )
        )
    }
    finally {
        $Hmac.Dispose()
    }
}

function Protect-DriveOSSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PlainText,

        [Parameter(Mandatory=$true)]
        [ValidateSet("desktop","web")]
        [string]$Mode,

        [byte[]]$EncryptionKey
    )

    if ($Mode -eq "desktop") {
        return $PlainText |
            ConvertTo-SecureString -AsPlainText -Force |
            ConvertFrom-SecureString
    }

    if (-not $EncryptionKey -or $EncryptionKey.Length -ne 32) {
        throw "DriveOS web encryption key is missing or invalid."
    }

    $EncryptionSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "encryption"

    $MacSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "authentication"

    $Aes = [Security.Cryptography.Aes]::Create()
    $Aes.KeySize = 256
    $Aes.BlockSize = 128
    $Aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $Aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $Aes.Key = $EncryptionSubkey
    $Aes.GenerateIV()

    try {
        $Encryptor = $Aes.CreateEncryptor()

        try {
            $PlainBytes = [Text.Encoding]::UTF8.GetBytes($PlainText)
            $CipherBytes = $Encryptor.TransformFinalBlock(
                $PlainBytes,
                0,
                $PlainBytes.Length
            )
        }
        finally {
            $Encryptor.Dispose()
        }

        $IvBytes = $Aes.IV
        $AuthenticatedBytes = [byte[]]($IvBytes + $CipherBytes)

        $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MacSubkey)

        try {
            $MacBytes = $Hmac.ComputeHash($AuthenticatedBytes)
        }
        finally {
            $Hmac.Dispose()
        }

        return "webv1:{0}:{1}:{2}" -f `
            [Convert]::ToBase64String($IvBytes), `
            [Convert]::ToBase64String($CipherBytes), `
            [Convert]::ToBase64String($MacBytes)
    }
    finally {
        $Aes.Dispose()
    }
}

function Unprotect-DriveOSSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProtectedText,

        [Parameter(Mandatory=$true)]
        [ValidateSet("desktop","web")]
        [string]$Mode,

        [byte[]]$EncryptionKey
    )

    if ($Mode -eq "desktop") {
        $SecureString = ConvertTo-SecureString $ProtectedText
        $Pointer = [IntPtr]::Zero

        try {
            $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
                $SecureString
            )

            return [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                $Pointer
            )
        }
        finally {
            if ($Pointer -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
            }
        }
    }

    if (-not $EncryptionKey -or $EncryptionKey.Length -ne 32) {
        throw "DriveOS web encryption key is missing or invalid."
    }

    $Parts = $ProtectedText.Split(':')

    if ($Parts.Count -ne 4 -or $Parts[0] -ne "webv1") {
        throw "DriveOS web secret has an unsupported format."
    }

    try {
        $IvBytes = [Convert]::FromBase64String($Parts[1])
        $CipherBytes = [Convert]::FromBase64String($Parts[2])
        $ProvidedMac = [Convert]::FromBase64String($Parts[3])
    }
    catch {
        throw "DriveOS web secret is malformed."
    }

    if ($IvBytes.Length -ne 16 -or $ProvidedMac.Length -ne 32) {
        throw "DriveOS web secret is malformed."
    }

    $EncryptionSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "encryption"

    $MacSubkey = Get-DriveOSDerivedSecretKey `
        -MasterKey $EncryptionKey `
        -Purpose "authentication"

    $AuthenticatedBytes = [byte[]]($IvBytes + $CipherBytes)
    $Hmac = New-Object Security.Cryptography.HMACSHA256(,$MacSubkey)

    try {
        $ExpectedMac = $Hmac.ComputeHash($AuthenticatedBytes)
    }
    finally {
        $Hmac.Dispose()
    }

    if (-not (
        Test-DriveOSSecretFixedTimeBytes `
            -Left $ExpectedMac `
            -Right $ProvidedMac
    )) {
        throw "DriveOS web secret authentication failed."
    }

    $Aes = [Security.Cryptography.Aes]::Create()
    $Aes.KeySize = 256
    $Aes.BlockSize = 128
    $Aes.Mode = [Security.Cryptography.CipherMode]::CBC
    $Aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
    $Aes.Key = $EncryptionSubkey
    $Aes.IV = $IvBytes

    try {
        $Decryptor = $Aes.CreateDecryptor()

        try {
            $PlainBytes = $Decryptor.TransformFinalBlock(
                $CipherBytes,
                0,
                $CipherBytes.Length
            )
        }
        finally {
            $Decryptor.Dispose()
        }

        return [Text.Encoding]::UTF8.GetString($PlainBytes)
    }
    finally {
        $Aes.Dispose()
    }
}

Export-ModuleMember -Function `
    Protect-DriveOSSecret, `
    Unprotect-DriveOSSecret