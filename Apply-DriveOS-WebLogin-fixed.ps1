$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$ServerPath = Join-Path $Root "DriveOS-Server.ps1"
$HostingTestsPath = Join-Path $Root "tests\WebHostingPrep.Tests.ps1"
$WebRequestModulePath = Join-Path $Root "src\Security\DriveOS.WebRequest.psm1"
$WebRequestTestsPath = Join-Path $Root "tests\WebRequest.Tests.ps1"
$LoginHtmlPath = Join-Path $Root "web\login.html"
$LoginJsPath = Join-Path $Root "web\login.js"

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $Directory = Split-Path -Parent $Path

    if (-not (Test-Path $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    $Encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Text,
        [Parameter(Mandatory = $true)]
        [string]$Old,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$New,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if (-not $Text.Contains($Old)) {
        throw "Could not find expected source block: $Description"
    }

    return $Text.Replace($Old, $New)
}

if (-not (Test-Path $ServerPath)) {
    throw "Run this script from the DriveOS repository root."
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $Branch = (& git branch --show-current 2>$null).Trim()

    if ($Branch -and $Branch -ne "web-hosting-prep") {
        throw "This patch must be applied on the web-hosting-prep branch. Current branch: $Branch"
    }

    $Changes = @(& git status --porcelain 2>$null)

    if ($Changes.Count -gt 0) {
        throw "Your Git working tree has uncommitted changes. Commit or stash them before applying this batch."
    }
}

$Server = [IO.File]::ReadAllText($ServerPath) -replace "`r`n", "`n"
$HostingTests = [IO.File]::ReadAllText($HostingTestsPath) -replace "`r`n", "`n"

# -----------------------------------------------------------------
# Server imports
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
Import-Module (Join-Path $PSScriptRoot "src\Http\DriveOS.Http.psm1") -Force
'@ `
    -New @'
Import-Module (Join-Path $PSScriptRoot "src\Http\DriveOS.Http.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebAuth.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebSession.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "src\Security\DriveOS.WebRequest.psm1") -Force
'@ `
    -Description "web security module imports"

# -----------------------------------------------------------------
# Web authentication configuration
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
$RuntimeConfig = Get-DriveOSRuntimeConfiguration -AppRoot $PSScriptRoot

$HostAddress = $RuntimeConfig.ListenAddress
'@ `
    -New @'
$RuntimeConfig = Get-DriveOSRuntimeConfiguration -AppRoot $PSScriptRoot
$WebAuthConfig = $null

if ($RuntimeConfig.IsWeb) {
    $WebAuthConfig = Get-DriveOSWebAuthConfiguration `
        -PublicUrl $RuntimeConfig.PublicUrl
}

$HostAddress = $RuntimeConfig.ListenAddress
'@ `
    -Description "web authentication startup configuration"

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
if (-not $MaintenanceMode -and $RuntimeConfig.IsWeb) {
    throw "DriveOS web runtime is not enabled until web authentication is configured."
}

'@ `
    -New "" `
    -Description "old web fail-closed placeholder"

# -----------------------------------------------------------------
# Allow JSON responses to emit Set-Cookie and Retry-After.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Send-Json {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        $Object,
        [int]$StatusCode = 200,
        [string]$StatusText = "OK"
    )

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonSafe $Object))
    Send-HttpResponse -Stream $Stream -StatusCode $StatusCode -StatusText $StatusText -ContentType "application/json; charset=utf-8" -Body $Bytes
}
'@ `
    -New @'
function Send-Json {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        $Object,
        [int]$StatusCode = 200,
        [string]$StatusText = "OK",
        [hashtable]$AdditionalHeaders = @{}
    )

    $Bytes = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-JsonSafe $Object))

    Send-HttpResponse `
        -Stream $Stream `
        -StatusCode $StatusCode `
        -StatusText $StatusText `
        -ContentType "application/json; charset=utf-8" `
        -Body $Bytes `
        -AdditionalHeaders $AdditionalHeaders
}
'@ `
    -Description "Send-Json additional headers"

# -----------------------------------------------------------------
# Add redirect + web-session helper functions before router.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

function Handle-Request {
'@ `
    -New @'
# ------------------------------------------------------------
# Hosted web authentication helpers
# ------------------------------------------------------------

function Send-Redirect {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [Parameter(Mandatory = $true)]
        [string]$Location
    )

    Send-HttpResponse `
        -Stream $Stream `
        -StatusCode 302 `
        -StatusText "Found" `
        -ContentType "text/plain; charset=utf-8" `
        -Body @() `
        -AdditionalHeaders @{
            Location = $Location
        }
}

function Test-DriveOSAuthenticatedWebRequest {
    param(
        [hashtable]$Headers
    )

    if (-not $RuntimeConfig.IsWeb -or -not $WebAuthConfig) {
        return $false
    }

    $Token = Get-DriveOSCookieValue `
        -Headers $Headers `
        -CookieName "DriveOSSession"

    if (-not $Token) {
        return $false
    }

    return Test-DriveOSWebSessionToken `
        -Token $Token `
        -OwnerEmail $WebAuthConfig.OwnerEmail `
        -AuthSecret $WebAuthConfig.AuthSecret
}

# ------------------------------------------------------------
# Router
# ------------------------------------------------------------

function Handle-Request {
'@ `
    -Description "hosted authentication helper insertion"

# -----------------------------------------------------------------
# Expand router parameters.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
function Handle-Request {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$Method,
        [string]$Path,
        [string]$BodyText
    )
'@ `
    -New @'
function Handle-Request {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [string]$Method,
        [string]$Path,
        [string]$BodyText,
        [hashtable]$Headers,
        [string]$ClientKey
    )
'@ `
    -Description "router parameters"

# -----------------------------------------------------------------
# Public login page + session status.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
                "/healthz" {
                    Send-Json -Stream $Stream -Object @{
                        status = "ok"
                    }
                    return
                }

                "/api/status" {
'@ `
    -New @'
                "/healthz" {
                    Send-Json -Stream $Stream -Object @{
                        status = "ok"
                    }
                    return
                }

                "/login" {
                    Send-StaticFile `
                        -Stream $Stream `
                        -RequestPath "/login.html"
                    return
                }

                "/api/auth/session" {
                    Send-Json -Stream $Stream -Object @{
                        authenticated = $true
                        ownerEmail = $WebAuthConfig.OwnerEmail
                    }
                    return
                }

                "/api/status" {
'@ `
    -Description "GET authentication routes"

# -----------------------------------------------------------------
# POST login/logout routes.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
        if ($Method -eq "POST") {
            switch ($Path) {

                "/api/spotify/connect" {
'@ `
    -New @'
        if ($Method -eq "POST") {
            switch ($Path) {
                "/api/auth/login" {
                    if (-not (Test-DriveOSLoginAllowed -ClientKey $ClientKey)) {
                        Send-Json `
                            -Stream $Stream `
                            -StatusCode 429 `
                            -StatusText "Too Many Requests" `
                            -AdditionalHeaders @{
                                "Retry-After" = "30"
                            } `
                            -Object @{
                                error = "Too many login attempts. Please wait and try again."
                            }
                        return
                    }

                    $Body = ConvertFrom-DriveOSRequestBody `
                        -BodyText $BodyText `
                        -RequiredFields email,password

                    $Email = "$($Body.email)".Trim().ToLowerInvariant()
                    $PasswordText = "$($Body.password)"
                    $SecurePassword = ConvertTo-SecureString `
                        $PasswordText `
                        -AsPlainText `
                        -Force

                    $Body.password = $null
                    $PasswordText = $null

                    $EmailOk = Test-FixedTimeStringEquals `
                        $Email `
                        $WebAuthConfig.OwnerEmail

                    $PasswordOk = Test-DriveOSPassword `
                        -Password $SecurePassword `
                        -StoredHash $WebAuthConfig.PasswordHash

                    if (-not $EmailOk -or -not $PasswordOk) {
                        Register-DriveOSLoginFailure -ClientKey $ClientKey

                        Send-Json `
                            -Stream $Stream `
                            -StatusCode 401 `
                            -StatusText "Unauthorized" `
                            -Object @{
                                error = "Invalid email or password."
                            }
                        return
                    }

                    Clear-DriveOSLoginFailures -ClientKey $ClientKey

                    $Token = New-DriveOSWebSessionToken `
                        -OwnerEmail $WebAuthConfig.OwnerEmail `
                        -AuthSecret $WebAuthConfig.AuthSecret `
                        -SessionHours $RuntimeConfig.SessionHours

                    $Cookie = New-DriveOSWebSessionCookie `
                        -Token $Token `
                        -SessionHours $RuntimeConfig.SessionHours

                    Send-Json `
                        -Stream $Stream `
                        -AdditionalHeaders @{
                            "Set-Cookie" = $Cookie
                        } `
                        -Object @{
                            authenticated = $true
                        }
                    return
                }

                "/api/auth/logout" {
                    Send-Json `
                        -Stream $Stream `
                        -AdditionalHeaders @{
                            "Set-Cookie" = (New-DriveOSWebSessionClearCookie)
                        } `
                        -Object @{
                            authenticated = $false
                        }
                    return
                }

                "/api/spotify/connect" {
'@ `
    -Description "POST authentication routes"

# -----------------------------------------------------------------
# Desktop authentication remains unchanged; web gets strict Host validation.
# -----------------------------------------------------------------

$OldDesktopAuth = @'
            $RequestHost = $Headers["host"].ToLowerInvariant()
            $IsLocalDesktopRequest = $RequestHost -eq $ExpectedHostHeader
            $IsTailscaleHost = $RequestHost -match $TailscaleHostPattern

            $LocalSessionOk =
                $IsLocalDesktopRequest -and
                $Headers.ContainsKey("x-driveos-session") -and
                (Test-FixedTimeStringEquals `
                    $Headers["x-driveos-session"] `
                    $SessionToken)

            # Tailscale Serve strips user-supplied identity headers and injects
            # authenticated identity headers on tailnet traffic. DriveOS still
            # listens only on localhost, matching Tailscale's recommended setup.
            $TailscaleIdentityOk =
                $Headers.ContainsKey("tailscale-user-login") -and
                -not [String]::IsNullOrWhiteSpace($Headers["tailscale-user-login"]) -and
                $Headers["tailscale-user-login"].Length -le 512

            # Reverse proxies may preserve the original ts.net Host or rewrite it
            # to the localhost target. Both are acceptable only when a verified
            # Tailscale identity header is present.
            $RemoteHostOk = $IsLocalDesktopRequest -or $IsTailscaleHost

            if (-not $LocalSessionOk -and (-not $TailscaleIdentityOk -or -not $RemoteHostOk)) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 403 `
                    -Text "Forbidden" `
                    -Message "DriveOS session authentication failed."

                continue
            }

            $IsRemoteTailscaleRequest = $TailscaleIdentityOk
'@

$NewDesktopAuth = @'
            $RequestHost = $Headers["host"].ToLowerInvariant()
            $IsRemoteTailscaleRequest = $false

            if ($RuntimeConfig.IsDesktop) {
                $IsLocalDesktopRequest = $RequestHost -eq $ExpectedHostHeader
                $IsTailscaleHost = $RequestHost -match $TailscaleHostPattern

                $LocalSessionOk =
                    $IsLocalDesktopRequest -and
                    $Headers.ContainsKey("x-driveos-session") -and
                    (Test-FixedTimeStringEquals `
                        $Headers["x-driveos-session"] `
                        $SessionToken)

                # Tailscale Serve strips user-supplied identity headers and injects
                # authenticated identity headers on tailnet traffic. DriveOS still
                # listens only on localhost, matching Tailscale's recommended setup.
                $TailscaleIdentityOk =
                    $Headers.ContainsKey("tailscale-user-login") -and
                    -not [String]::IsNullOrWhiteSpace($Headers["tailscale-user-login"]) -and
                    $Headers["tailscale-user-login"].Length -le 512

                # Reverse proxies may preserve the original ts.net Host or rewrite it
                # to the localhost target. Both are acceptable only when a verified
                # Tailscale identity header is present.
                $RemoteHostOk = $IsLocalDesktopRequest -or $IsTailscaleHost

                if (
                    -not $LocalSessionOk -and
                    (-not $TailscaleIdentityOk -or -not $RemoteHostOk)
                ) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "DriveOS session authentication failed."

                    continue
                }

                $IsRemoteTailscaleRequest = $TailscaleIdentityOk
            }
            elseif (-not (
                Test-DriveOSWebHost `
                    -HostHeader $RequestHost `
                    -PublicUrl $RuntimeConfig.PublicUrl
            )) {
                Send-RequestRejected `
                    -Stream $Stream `
                    -Code 400 `
                    -Text "Bad Request" `
                    -Message "Invalid host."

                continue
            }
'@

$Server = Replace-Exact `
    -Text $Server `
    -Old $OldDesktopAuth `
    -New $NewDesktopAuth `
    -Description "desktop/web request authentication split"

# -----------------------------------------------------------------
# Web Origin/CSRF + session gate after request path is known.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
            $Path = ($Target -split "\?", 2)[0]
            $BodyText = ""

            $ContentLength = 0
'@ `
    -New @'
            $Path = ($Target -split "\?", 2)[0]
            $BodyText = ""

            if ($RuntimeConfig.IsWeb) {
                if (
                    $Method -eq "POST" -and
                    -not (
                        Test-DriveOSWebOrigin `
                            -Headers $Headers `
                            -PublicUrl $RuntimeConfig.PublicUrl
                    )
                ) {
                    Send-RequestRejected `
                        -Stream $Stream `
                        -Code 403 `
                        -Text "Forbidden" `
                        -Message "Request origin validation failed."

                    continue
                }

                $WebSessionOk = Test-DriveOSAuthenticatedWebRequest `
                    -Headers $Headers

                $IsPublicWebRequest = Test-DriveOSWebPublicRequest `
                    -Method $Method `
                    -Path $Path

                if (
                    -not $IsPublicWebRequest -and
                    -not $WebSessionOk
                ) {
                    if ($Path.StartsWith("/api/")) {
                        Send-RequestRejected `
                            -Stream $Stream `
                            -Code 401 `
                            -Text "Unauthorized" `
                            -Message "Authentication required."
                    }
                    else {
                        Send-Redirect `
                            -Stream $Stream `
                            -Location "/login"
                    }

                    continue
                }

                if (
                    $WebSessionOk -and
                    $Method -eq "GET" -and
                    $Path -in @("/login", "/login.html")
                ) {
                    Send-Redirect `
                        -Stream $Stream `
                        -Location "/"

                    continue
                }
            }

            $ContentLength = 0
'@ `
    -Description "web origin and session gate"

# -----------------------------------------------------------------
# Router needs request headers/client key.
# -----------------------------------------------------------------

$Server = Replace-Exact `
    -Text $Server `
    -Old @'
            Handle-Request `
                -Stream $Stream `
                -Method $Method `
                -Path $Path `
                -BodyText $BodyText
'@ `
    -New @'
            Handle-Request `
                -Stream $Stream `
                -Method $Method `
                -Path $Path `
                -BodyText $BodyText `
                -Headers $Headers `
                -ClientKey $Remote.Address.ToString()
'@ `
    -Description "router request context"

# -----------------------------------------------------------------
# Web request security module.
# -----------------------------------------------------------------

$WebRequestModule = @'
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
            "/login.js"
        )
    }

    if ($Method -eq "POST") {
        return $Path -eq "/api/auth/login"
    }

    return $false
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
    Test-DriveOSLoginAllowed, `
    Register-DriveOSLoginFailure, `
    Clear-DriveOSLoginFailures
'@

# -----------------------------------------------------------------
# Login UI.
# -----------------------------------------------------------------

$LoginHtml = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DriveOS Sign In</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at top, rgba(42, 85, 120, .35), transparent 38rem),
        #0b0f14;
      color: #f4f7fb;
      padding: 24px;
    }
    main {
      width: min(100%, 420px);
      background: rgba(19, 25, 33, .94);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 22px;
      padding: 30px;
      box-shadow: 0 24px 80px rgba(0,0,0,.35);
    }
    h1 { margin: 0 0 8px; font-size: 1.9rem; }
    p { color: #aeb8c5; margin: 0 0 24px; }
    label { display: block; margin: 16px 0 7px; font-weight: 600; }
    input {
      width: 100%;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      background: #0e141b;
      color: #fff;
      padding: 13px 14px;
      font: inherit;
    }
    input:focus { outline: 2px solid rgba(130,190,255,.65); outline-offset: 1px; }
    button {
      width: 100%;
      margin-top: 22px;
      border: 0;
      border-radius: 12px;
      padding: 13px 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled { opacity: .6; cursor: wait; }
    #message { min-height: 1.4em; margin: 14px 0 0; color: #ffb5b5; }
  </style>
  <script src="/login.js" defer></script>
</head>
<body>
  <main>
    <h1>DriveOS</h1>
    <p>Sign in to your private dashboard.</p>

    <form id="loginForm">
      <label for="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autocomplete="username"
        required>

      <label for="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password"
        required>

      <button id="submitButton" type="submit">Sign in</button>
      <div id="message" role="alert" aria-live="polite"></div>
    </form>
  </main>
</body>
</html>
'@

$LoginJs = @'
(() => {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("submitButton");
  const message = document.getElementById("message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    button.disabled = true;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        message.textContent =
          data.error || "Sign in failed. Please try again.";
        return;
      }

      form.password.value = "";
      window.location.replace("/");
    }
    catch {
      message.textContent =
        "DriveOS could not be reached. Please try again.";
    }
    finally {
      button.disabled = false;
    }
  });
})();
'@

# -----------------------------------------------------------------
# Web request unit tests.
# -----------------------------------------------------------------

$WebRequestTests = @'
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
'@

# -----------------------------------------------------------------
# Update existing hosting test contract.
# -----------------------------------------------------------------

$HostingTests = Replace-Exact `
    -Text $HostingTests `
    -Old @'
    Assert-True `
        ($ServerSource -match 'web runtime is not enabled until web authentication is configured') `
        "Web mode must remain disabled until web authentication exists."
'@ `
    -New @'
    Assert-True `
        ($ServerSource -match 'Get-DriveOSWebAuthConfiguration') `
        "Web mode must load validated authentication configuration before serving requests."

    Assert-True `
        ($ServerSource -match 'DriveOS\.WebSession\.psm1') `
        "Web mode must load the signed-session module."

    Assert-True `
        ($ServerSource -match 'DriveOS\.WebRequest\.psm1') `
        "Web mode must load web request security helpers."
'@ `
    -Description "web authentication startup test"

$HostingInsert = @'

    # --------------------------------------------------------
    # Hosted login/session routing contract.
    # --------------------------------------------------------

    Assert-True `
        ($ServerSource -match '"/api/auth/login"') `
        "DriveOS must expose the hosted login endpoint."

    Assert-True `
        ($ServerSource -match '"/api/auth/logout"') `
        "DriveOS must expose the hosted logout endpoint."

    Assert-True `
        ($ServerSource -match 'Test-DriveOSWebOrigin') `
        "Hosted POST requests must use origin validation."

    Assert-True `
        ($ServerSource -match 'Test-DriveOSWebSessionToken') `
        "Protected hosted requests must validate signed sessions."

    Assert-True `
        ($ServerSource -match '"Set-Cookie"') `
        "Hosted login/logout responses must emit a session cookie."

    Assert-True `
        (Test-Path (Join-Path $Root "web\login.html")) `
        "Hosted login page is missing."

    Assert-True `
        (Test-Path (Join-Path $Root "web\login.js")) `
        "Hosted login script is missing."
'@

$HostingTests = Replace-Exact `
    -Text $HostingTests `
    -Old @'
    Write-Host `
        "DriveOS web-hosting configuration checks passed." `
        -ForegroundColor Green
'@ `
    -New ($HostingInsert + @'

    Write-Host `
        "DriveOS web-hosting configuration checks passed." `
        -ForegroundColor Green
'@) `
    -Description "hosted login routing tests"

# -----------------------------------------------------------------
# Final source validations before writing anything.
# -----------------------------------------------------------------

foreach ($Required in @(
    'Get-DriveOSWebAuthConfiguration',
    'Test-DriveOSWebSessionToken',
    'Test-DriveOSWebOrigin',
    '"/api/auth/login"',
    '"/api/auth/logout"',
    '"Set-Cookie"',
    'Test-DriveOSWebHost'
)) {
    if (-not $Server.Contains($Required)) {
        throw "Patch validation failed. Server is missing: $Required"
    }
}

# -----------------------------------------------------------------
# Write files only after every transformation succeeded.
# -----------------------------------------------------------------

Write-Utf8NoBom -Path $ServerPath -Content $Server
Write-Utf8NoBom -Path $HostingTestsPath -Content $HostingTests
Write-Utf8NoBom -Path $WebRequestModulePath -Content $WebRequestModule
Write-Utf8NoBom -Path $WebRequestTestsPath -Content $WebRequestTests
Write-Utf8NoBom -Path $LoginHtmlPath -Content $LoginHtml
Write-Utf8NoBom -Path $LoginJsPath -Content $LoginJs

Write-Host ""
Write-Host "DriveOS hosted-login batch applied successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Run these tests next:"
Write-Host "  .\tests\WebHostingPrep.Tests.ps1"
Write-Host "  .\tests\WebAuth.Tests.ps1"
Write-Host "  .\tests\WebSession.Tests.ps1"
Write-Host "  .\tests\WebRequest.Tests.ps1"
