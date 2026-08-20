$ErrorActionPreference = "Stop"

# ============================================================
# DriveOS - Spotify Authorization 1.0
# Authorization Code + PKCE
# Windows PowerShell 5.1 compatible
#
# Includes the permissions needed by the embedded JourneyDeck Web Player.
# ============================================================

if (-not $env:SPOTIFY_CLIENT_ID) {
    throw "SPOTIFY_CLIENT_ID was not provided by 1Password."
}

$ClientId = $env:SPOTIFY_CLIENT_ID
$RedirectUri = "http://127.0.0.1:8888/callback"

$Scopes = @(
    "user-read-recently-played"
    "user-read-playback-state"
    "user-read-currently-playing"
    "user-modify-playback-state"
    "user-read-email"
    "user-read-private"
    "user-library-modify"
    "streaming"
    "playlist-modify-private"
) -join " "

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)

    return [Convert]::ToBase64String($Bytes).
        TrimEnd('=').
        Replace('+', '-').
        Replace('/', '_')
}

# PKCE verifier
$RandomBytes = New-Object byte[] 64
$Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$Rng.GetBytes($RandomBytes)
$Rng.Dispose()

$CodeVerifier = ConvertTo-Base64Url $RandomBytes

$Sha256 = [System.Security.Cryptography.SHA256]::Create()
$ChallengeBytes = $Sha256.ComputeHash(
    [System.Text.Encoding]::ASCII.GetBytes($CodeVerifier)
)
$Sha256.Dispose()

$CodeChallenge = ConvertTo-Base64Url $ChallengeBytes

# CSRF state
$StateBytes = New-Object byte[] 16
$Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$Rng.GetBytes($StateBytes)
$Rng.Dispose()

$State = ConvertTo-Base64Url $StateBytes

$AuthUrl =
    "https://accounts.spotify.com/authorize" +
    "?client_id=$([uri]::EscapeDataString($ClientId))" +
    "&response_type=code" +
    "&redirect_uri=$([uri]::EscapeDataString($RedirectUri))" +
    "&scope=$([uri]::EscapeDataString($Scopes))" +
    "&code_challenge_method=S256" +
    "&code_challenge=$([uri]::EscapeDataString($CodeChallenge))" +
    "&state=$([uri]::EscapeDataString($State))"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "       DRIVE OS - SPOTIFY AUTH 1.0          " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "This one-time authorization enables the JourneyDeck" -ForegroundColor Cyan
Write-Host "Spotify player and private drive playlists." -ForegroundColor Cyan
Write-Host ""

$Listener = [System.Net.Sockets.TcpListener]::new(
    [System.Net.IPAddress]::Loopback,
    8888
)

$Listener.Start()

try {
    Write-Host "Opening Spotify..." -ForegroundColor Cyan
    Start-Process $AuthUrl
    Write-Host "Waiting for authorization..." -ForegroundColor Yellow

    $Accept = $Listener.BeginAcceptTcpClient($null, $null)

    if (-not $Accept.AsyncWaitHandle.WaitOne([TimeSpan]::FromMinutes(5))) {
        throw "Spotify authorization timed out after 5 minutes."
    }

    $Client = $Listener.EndAcceptTcpClient($Accept)
    $Stream = $Client.GetStream()
    $Reader = New-Object System.IO.StreamReader($Stream)

    $RequestLine = $Reader.ReadLine()

    while (($line = $Reader.ReadLine()) -ne "") {}

    $RequestTarget = ($RequestLine -split " ")[1]
    $CallbackUri = [Uri]("http://127.0.0.1:8888$RequestTarget")

    $Query = @{}

    foreach ($Pair in $CallbackUri.Query.TrimStart("?").Split("&")) {
        if ($Pair) {
            $Parts = $Pair.Split("=", 2)
            $Key = [uri]::UnescapeDataString($Parts[0])
            $Value = if ($Parts.Count -gt 1) {
                [uri]::UnescapeDataString($Parts[1])
            } else {
                ""
            }

            $Query[$Key] = $Value
        }
    }

    $Success = [bool]$Query["code"] -and ($Query["state"] -eq $State)

    $Html = if ($Success) {
@"
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>DriveOS</title>
<style>
body{background:#080b10;color:#f7f8fb;font-family:Segoe UI,Arial;display:grid;place-items:center;height:100vh;margin:0}
main{text-align:center;padding:40px}
h1{font-size:48px;margin:0 0 12px}
span{color:#7be7ff}
p{color:#9ca6b6;font-size:18px}
</style>
</head>
<body>
<main>
<h1>DRIVE<span>OS</span></h1>
<p>Spotify authorization updated successfully.</p>
<p>You can close this tab.</p>
</main>
</body>
</html>
"@
    }
    else {
@"
<html><body><h1>DriveOS</h1><p>Spotify authorization failed.</p></body></html>
"@
    }

    $Body = [System.Text.Encoding]::UTF8.GetBytes($Html)

    $Header =
        "HTTP/1.1 200 OK`r`n" +
        "Content-Type: text/html; charset=utf-8`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Connection: close`r`n`r`n"

    $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)

    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    $Stream.Write($Body, 0, $Body.Length)
    $Stream.Flush()

    $Client.Close()
}
finally {
    $Listener.Stop()
}

if ($Query["error"]) {
    throw "Spotify authorization failed: $($Query["error"])"
}

if (-not $Query["code"]) {
    throw "Spotify did not return an authorization code."
}

if ($Query["state"] -ne $State) {
    throw "Spotify authorization state did not match."
}

Write-Host ""
Write-Host "Spotify approved DriveOS." -ForegroundColor Green
Write-Host "Requesting updated tokens..." -ForegroundColor Cyan

$TokenResponse = Invoke-RestMethod `
    -Uri "https://accounts.spotify.com/api/token" `
    -Method Post `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
        client_id     = $ClientId
        grant_type    = "authorization_code"
        code          = $Query["code"]
        redirect_uri  = $RedirectUri
        code_verifier = $CodeVerifier
    }

$DataDirectory = Join-Path $PSScriptRoot "data"

if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}


function Protect-DriveOSPrivateFileAcl {
    param([Parameter(Mandatory=$true)][string]$Path)

    try {
        $UserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
        $SystemSid = New-Object System.Security.Principal.SecurityIdentifier(
            [System.Security.Principal.WellKnownSidType]::LocalSystemSid,
            $null
        )

        $Acl = New-Object System.Security.AccessControl.FileSecurity
        $Acl.SetOwner($UserSid)
        $Acl.SetAccessRuleProtection($true, $false)

        $Rights = [System.Security.AccessControl.FileSystemRights]::FullControl
        $Allow = [System.Security.AccessControl.AccessControlType]::Allow
        $NoneI = [System.Security.AccessControl.InheritanceFlags]::None
        $NoneP = [System.Security.AccessControl.PropagationFlags]::None

        $Acl.AddAccessRule(
            (New-Object System.Security.AccessControl.FileSystemAccessRule(
                $UserSid, $Rights, $NoneI, $NoneP, $Allow
            ))
        )

        $Acl.AddAccessRule(
            (New-Object System.Security.AccessControl.FileSystemAccessRule(
                $SystemSid, $Rights, $NoneI, $NoneP, $Allow
            ))
        )

        Set-Acl -Path $Path -AclObject $Acl
    }
    catch {
        Write-Warning "Spotify token ACL hardening could not be applied. DPAPI encryption remains active."
    }
}

$SpotifyTokenPath = Join-Path $DataDirectory "spotify-token.json"

$EncryptedAccessToken = $TokenResponse.access_token |
    ConvertTo-SecureString -AsPlainText -Force |
    ConvertFrom-SecureString

$EncryptedRefreshToken = $TokenResponse.refresh_token |
    ConvertTo-SecureString -AsPlainText -Force |
    ConvertFrom-SecureString

[PSCustomObject]@{
    AccessToken  = $EncryptedAccessToken
    RefreshToken = $EncryptedRefreshToken
    ExpiresAt    = (Get-Date).AddSeconds([int]$TokenResponse.expires_in).ToString("o")
    Scope        = $TokenResponse.scope
} |
    ConvertTo-Json |
    Set-Content -Path $SpotifyTokenPath -Encoding UTF8

Protect-DriveOSPrivateFileAcl -Path $SpotifyTokenPath

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "              SPOTIFY READY                   " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "DriveOS can now create private drive playlists." -ForegroundColor Green
Write-Host ""
