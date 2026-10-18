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

$SyncSecret = '0123456789abcdef0123456789abcdef'
$SyncHeaders = @{ 'x-driveos-sync-token' = $SyncSecret }
Assert-True `
    (Test-DriveOSScheduledSyncRequest -IsWeb $true -Method POST -Path '/api/spotify/sync' -Headers $SyncHeaders -ExpectedSecret $SyncSecret) `
    'A valid hosted scheduled sync request should be accepted.'
Assert-True `
    (-not (Test-DriveOSScheduledSyncRequest -IsWeb $false -Method POST -Path '/api/spotify/sync' -Headers $SyncHeaders -ExpectedSecret $SyncSecret)) `
    'Desktop DriveOS must reject scheduled sync requests.'
Assert-True `
    (-not (Test-DriveOSScheduledSyncRequest -IsWeb $true -Method GET -Path '/api/spotify/sync' -Headers $SyncHeaders -ExpectedSecret $SyncSecret)) `
    'Scheduled sync must reject the wrong HTTP method.'
Assert-True `
    (-not (Test-DriveOSScheduledSyncRequest -IsWeb $true -Method POST -Path '/api/spotify/sync' -Headers @{ 'x-driveos-sync-token' = 'wrong' } -ExpectedSecret $SyncSecret)) `
    'Scheduled sync must reject an invalid secret.'
Assert-True `
    (-not (Test-DriveOSScheduledSyncRequest -IsWeb $true -Method POST -Path '/api/spotify/sync' -Headers $SyncHeaders -ExpectedSecret 'too-short')) `
    'Scheduled sync must reject weak server secrets.'

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

$Proxy = [System.Net.IPAddress]::Parse("127.0.0.1")
$MappedProxy = [System.Net.IPAddress]::Parse("::ffff:127.0.0.1")
$PublicClient = [System.Net.IPAddress]::Parse("203.0.113.8")
$AttackerHeaders = @{ "x-driveos-client-ip" = "203.0.113.50" }
$OwnerHeaders = @{ "x-driveos-client-ip" = "198.51.100.20" }

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers $AttackerHeaders -TrustLoopbackClientHeader $true) -eq "203.0.113.50") `
    "The Node proxy on 127.0.0.1 should key login throttling by the forwarded client."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $MappedProxy -Headers $OwnerHeaders -TrustLoopbackClientHeader $true) -eq "198.51.100.20") `
    "An IPv4-mapped loopback proxy should honor the forwarded client."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress ([System.Net.IPAddress]::IPv6Loopback) -Headers $OwnerHeaders -TrustLoopbackClientHeader $true) -eq "198.51.100.20") `
    "The IPv6 loopback proxy should honor the forwarded client."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers @{} -TrustLoopbackClientHeader $true) -eq "127.0.0.1") `
    "A proxy request without a client address should keep the socket address."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers @{ "x-driveos-client-ip" = "203.0.113.50, 198.51.100.20" } -TrustLoopbackClientHeader $true) -eq "127.0.0.1") `
    "A multi-value client address header must not choose the throttle key."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers @{ "x-driveos-client-ip" = "not-an-ip" } -TrustLoopbackClientHeader $true) -eq "127.0.0.1") `
    "An invalid client address header must fall back to the socket address."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $PublicClient -Headers $OwnerHeaders -TrustLoopbackClientHeader $true) -eq "203.0.113.8") `
    "A request that did not come from the Node proxy must ignore the client address header."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress ([System.Net.IPAddress]::Parse("127.0.0.2")) -Headers $OwnerHeaders -TrustLoopbackClientHeader $true) -eq "127.0.0.2") `
    "Only the Node proxy address 127.0.0.1 may supply the client address header."

Assert-True `
    ((Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers $OwnerHeaders -TrustLoopbackClientHeader $false) -eq "127.0.0.1") `
    "Desktop loopback clients must not supply the hosted proxy client header."

$AttackerKey = Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers $AttackerHeaders -TrustLoopbackClientHeader $true
$OwnerKey = Get-DriveOSLoginClientKey -RemoteAddress $Proxy -Headers $OwnerHeaders -TrustLoopbackClientHeader $true
$OutsideKey = Get-DriveOSLoginClientKey -RemoteAddress $PublicClient -Headers $OwnerHeaders -TrustLoopbackClientHeader $true

1..5 | ForEach-Object {
    Register-DriveOSLoginFailure -ClientKey $AttackerKey -Now $Now
}

Assert-True `
    (-not (Test-DriveOSLoginAllowed -ClientKey $AttackerKey -Now $Now.AddSeconds(1))) `
    "Repeated failures from one forwarded client must throttle that client."

Assert-True `
    (Test-DriveOSLoginAllowed -ClientKey $OwnerKey -Now $Now.AddSeconds(1)) `
    "Failures from one client must not lock out a different client."

Assert-True `
    (Test-DriveOSLoginAllowed -ClientKey $OutsideKey -Now $Now.AddSeconds(1)) `
    "A directly connected client must keep its own throttle key."

Clear-DriveOSLoginFailures -ClientKey $AttackerKey
Clear-DriveOSLoginFailures -ClientKey $OwnerKey
Clear-DriveOSLoginFailures -ClientKey $OutsideKey

Write-Host `
    "DriveOS web request security checks passed." `
    -ForegroundColor Green
