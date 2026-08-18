Set-StrictMode -Version 2.0

$script:DriveOSSessionVersion = "v1"
$script:DriveOSSessionCookieName = "DriveOSSession"

function ConvertTo-DriveOSBase64Url {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes
    )

    return [Convert]::ToBase64String($Bytes).
        TrimEnd('=').
        Replace('+', '-').
        Replace('/', '_')
}

function ConvertFrom-DriveOSBase64Url {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $Base64 = $Value.Replace('-', '+').Replace('_', '/')

    switch ($Base64.Length % 4) {
        2 { $Base64 += "==" }
        3 { $Base64 += "=" }
        0 {}
        default { throw "Invalid Base64URL value." }
    }

    return [Convert]::FromBase64String($Base64)
}

function Test-DriveOSSessionFixedTimeBytes {
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
        $Difference = $Difference -bor (
            $Left[$Index] -bxor $Right[$Index]
        )
    }

    return ($Difference -eq 0)
}

function Get-DriveOSSessionSignature {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SignedValue,

        [Parameter(Mandatory = $true)]
        [byte[]]$AuthSecret
    )

    if ($AuthSecret.Length -lt 32) {
        throw "DriveOS session signing secret must contain at least 32 bytes."
    }

    $Hmac = New-Object `
        System.Security.Cryptography.HMACSHA256(,$AuthSecret)

    try {
        $Bytes = [Text.Encoding]::UTF8.GetBytes($SignedValue)
        return $Hmac.ComputeHash($Bytes)
    }
    finally {
        $Hmac.Dispose()
    }
}

function New-DriveOSWebSessionToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$OwnerEmail,

        [ValidateSet("owner", "wife")]
        [string]$Role = "owner",

        [ValidateSet("wife", "full")]
        [string]$Mode = "full",

        [Parameter(Mandatory = $true)]
        [byte[]]$AuthSecret,

        [ValidateRange(1, 720)]
        [int]$SessionHours = 24,

        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow
    )

    $NormalizedEmail = $OwnerEmail.Trim().ToLowerInvariant()

    if (-not $NormalizedEmail) {
        throw "Owner email is required."
    }

    $NonceBytes = New-Object byte[] 16
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($NonceBytes)
    }
    finally {
        $Random.Dispose()
    }

    $IssuedAt = $Now.ToUnixTimeSeconds()
    $ExpiresAt = $Now.AddHours($SessionHours).ToUnixTimeSeconds()

    $Payload = [ordered]@{
        v     = 1
        sub   = $NormalizedEmail
        role  = $Role
        mode  = $Mode
        iat   = $IssuedAt
        exp   = $ExpiresAt
        nonce = ConvertTo-DriveOSBase64Url -Bytes $NonceBytes
    }

    $PayloadJson = $Payload | ConvertTo-Json -Compress
    $PayloadBytes = [Text.Encoding]::UTF8.GetBytes($PayloadJson)
    $PayloadEncoded = ConvertTo-DriveOSBase64Url -Bytes $PayloadBytes

    $SignedValue = "$script:DriveOSSessionVersion.$PayloadEncoded"

    $Signature = Get-DriveOSSessionSignature `
        -SignedValue $SignedValue `
        -AuthSecret $AuthSecret

    $SignatureEncoded = ConvertTo-DriveOSBase64Url -Bytes $Signature

    return "$SignedValue.$SignatureEncoded"
}

function Get-DriveOSWebSessionPrincipal {
    param(
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][byte[]]$AuthSecret,
        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow
    )

    try {
        $Parts = $Token.Split('.')
        if ($Parts.Count -ne 3 -or $Parts[0] -ne $script:DriveOSSessionVersion) { return $null }
        $SignedValue = "$($Parts[0]).$($Parts[1])"
        $Expected = Get-DriveOSSessionSignature -SignedValue $SignedValue -AuthSecret $AuthSecret
        $Provided = ConvertFrom-DriveOSBase64Url -Value $Parts[2]
        if (-not (Test-DriveOSSessionFixedTimeBytes -Left $Expected -Right $Provided)) { return $null }
        $Payload = ([Text.Encoding]::UTF8.GetString((ConvertFrom-DriveOSBase64Url -Value $Parts[1]))) | ConvertFrom-Json
        $Role = "$($Payload.role)".Trim().ToLowerInvariant()
        $Mode = "$($Payload.mode)".Trim().ToLowerInvariant()
        $Subject = "$($Payload.sub)".Trim().ToLowerInvariant()
        if (-not $Payload -or [int]$Payload.v -ne 1 -or $Role -notin @("owner", "wife") -or $Mode -notin @("wife", "full") -or -not $Subject -or -not "$($Payload.nonce)") { return $null }
        $NowUnix = $Now.ToUnixTimeSeconds(); $IssuedAt = [long]$Payload.iat; $ExpiresAt = [long]$Payload.exp
        if ($ExpiresAt -le $IssuedAt -or $ExpiresAt -le $NowUnix -or $IssuedAt -gt ($NowUnix + 300)) { return $null }
        return [PSCustomObject]@{ Subject = $Subject; Role = $Role; Mode = $Mode }
    }
    catch { return $null }
}

function Test-DriveOSWebSessionToken {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token,

        [Parameter(Mandatory = $true)]
        [string]$OwnerEmail,

        [Parameter(Mandatory = $true)]
        [byte[]]$AuthSecret,

        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow
    )

    try {
        $Principal = Get-DriveOSWebSessionPrincipal -Token $Token -AuthSecret $AuthSecret -Now $Now
        if (-not $Principal -or $Principal.Role -ne "owner") { return $false }
        return $Principal.Subject -eq $OwnerEmail.Trim().ToLowerInvariant()
    }
    catch {
        return $false
    }
}

function New-DriveOSWebSessionCookie {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token,

        [ValidateRange(1, 720)]
        [int]$SessionHours = 24,

        [bool]$Persist = $true
    )

    $MaxAge = $SessionHours * 3600

    $Cookie = "$script:DriveOSSessionCookieName=$Token; Path=/; HttpOnly; Secure; SameSite=Strict"
    if ($Persist) { $Cookie += "; Max-Age=$MaxAge" }
    return $Cookie
}

function New-DriveOSWebSessionClearCookie {
    return (
        "$script:DriveOSSessionCookieName=; " +
        "Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    )
}

Export-ModuleMember -Function `
    New-DriveOSWebSessionToken, `
    Get-DriveOSWebSessionPrincipal, `
    Test-DriveOSWebSessionToken, `
    New-DriveOSWebSessionCookie, `
    New-DriveOSWebSessionClearCookie
