Set-StrictMode -Version 2.0

$script:DriveOSLoginFailures = @{}

function Get-DriveOSCookieValue {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Headers,

        [Parameter(Mandatory = $true)]
        [string]$CookieName
    )

    if (-not $Headers.ContainsKey("cookie")) {
        return $null
    }

    $HeaderValue = "$($Headers["cookie"])"

    if (-not $HeaderValue -or $HeaderValue.Length -gt 8192) {
        return $null
    }

    $Matches = @()

    foreach ($Part in $HeaderValue.Split(';')) {
        $Pair = $Part.Trim()
        $Equals = $Pair.IndexOf('=')

        if ($Equals -le 0) {
            continue
        }

        $Name = $Pair.Substring(0, $Equals).Trim()
        $Value = $Pair.Substring($Equals + 1).Trim()

        if ($Name -ceq $CookieName) {
            $Matches += $Value
        }
    }

    if ($Matches.Count -ne 1) {
        return $null
    }

    if (-not $Matches[0] -or $Matches[0].Length -gt 4096) {
        return $null
    }

    return $Matches[0]
}

function Test-DriveOSWebHost {
    param(
        [Parameter(Mandatory = $true)]
        [string]$HostHeader,

        [Parameter(Mandatory = $true)]
        [string]$PublicUrl
    )

    try {
        $PublicUri = [Uri]$PublicUrl
    }
    catch {
        return $false
    }

    $Expected = $PublicUri.Authority.ToLowerInvariant()
    $Candidate = "$HostHeader".Trim().ToLowerInvariant()

    if (
        -not $Candidate -or
        $Candidate.Contains(",") -or
        $Candidate.Contains(" ") -or
        $Candidate.Contains("`t")
    ) {
        return $false
    }

    return $Candidate -ceq $Expected
}

function Test-DriveOSWebOrigin {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Headers,

        [Parameter(Mandatory = $true)]
        [string]$PublicUrl
    )

    if (-not $Headers.ContainsKey("origin")) {
        return $false
    }

    try {
        $Expected = ([Uri]$PublicUrl).
            GetLeftPart([UriPartial]::Authority).
            TrimEnd('/')

        $Actual = ([Uri]"$($Headers["origin"])").
            GetLeftPart([UriPartial]::Authority).
            TrimEnd('/')
    }
    catch {
        return $false
    }

    if (-not $Actual.Equals(
        $Expected,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        return $false
    }

    if (
        $Headers.ContainsKey("sec-fetch-site") -and
        "$($Headers["sec-fetch-site"])".ToLowerInvariant() -notin @(
            "same-origin",
            "none"
        )
    ) {
        return $false
    }

    return $true
}

function Test-DriveOSWebPublicRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $Method = $Method.ToUpperInvariant()

    if ($Method -eq "GET") {
        return $Path -in @(
            "/healthz",
            "/login",
            "/login.html",
            "/login.js",
            "/auth/spotify/callback"
        )
    }

    if ($Method -eq "POST") {
        return $Path -in @("/api/auth/login","/api/auth/passkey/options","/api/auth/passkey/verify")
    }

    return $false
}

function Test-DriveOSScheduledSyncRequest {
    param(
        [bool]$IsWeb,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [AllowEmptyString()][string]$ExpectedSecret
    )

    if (
        -not $IsWeb -or
        $Method.ToUpperInvariant() -ne 'POST' -or
        $Path -ne '/api/spotify/sync' -or
        [String]::IsNullOrWhiteSpace($ExpectedSecret) -or
        $ExpectedSecret.Length -lt 32 -or
        -not $Headers.ContainsKey('x-driveos-sync-token')
    ) {
        return $false
    }

    $Candidate = "$($Headers['x-driveos-sync-token'])"
    if ([String]::IsNullOrWhiteSpace($Candidate) -or $Candidate.Length -gt 512) {
        return $false
    }

    $A = [Text.Encoding]::UTF8.GetBytes($Candidate)
    $B = [Text.Encoding]::UTF8.GetBytes($ExpectedSecret)
    $Difference = $A.Length -bxor $B.Length
    $Max = [Math]::Max($A.Length, $B.Length)
    for ($Index = 0; $Index -lt $Max; $Index++) {
        $Left = if ($Index -lt $A.Length) { $A[$Index] } else { 0 }
        $Right = if ($Index -lt $B.Length) { $B[$Index] } else { 0 }
        $Difference = $Difference -bor ($Left -bxor $Right)
    }
    return $Difference -eq 0
}

function Test-DriveOSLoginAllowed {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ClientKey,

        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow
    )

    if (-not $script:DriveOSLoginFailures.ContainsKey($ClientKey)) {
        return $true
    }

    $State = $script:DriveOSLoginFailures[$ClientKey]

    if ($State.BlockedUntil -and $Now -lt $State.BlockedUntil) {
        return $false
    }

    return $true
}

function Register-DriveOSLoginFailure {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ClientKey,

        [DateTimeOffset]$Now = [DateTimeOffset]::UtcNow
    )

    $State = $null

    if ($script:DriveOSLoginFailures.ContainsKey($ClientKey)) {
        $State = $script:DriveOSLoginFailures[$ClientKey]

        if ($Now -gt $State.LastFailure.AddMinutes(15)) {
            $State = $null
        }
    }

    if (-not $State) {
        $State = [PSCustomObject]@{
            Count        = 0
            LastFailure  = $Now
            BlockedUntil = $null
        }
    }

    $State.Count++
    $State.LastFailure = $Now

    if ($State.Count -ge 5) {
        $State.BlockedUntil = $Now.AddSeconds(30)
    }

    $script:DriveOSLoginFailures[$ClientKey] = $State
}

function Clear-DriveOSLoginFailures {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ClientKey
    )

    $script:DriveOSLoginFailures.Remove($ClientKey)
}

Export-ModuleMember -Function `
    Get-DriveOSCookieValue, `
    Test-DriveOSWebHost, `
    Test-DriveOSWebOrigin, `
    Test-DriveOSWebPublicRequest, `
    Test-DriveOSScheduledSyncRequest, `
    Test-DriveOSLoginAllowed, `
    Register-DriveOSLoginFailure, `
    Clear-DriveOSLoginFailures
