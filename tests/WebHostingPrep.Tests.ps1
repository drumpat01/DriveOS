$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ConfigModule = Join-Path $Root "src\Configuration\DriveOS.Configuration.psm1"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Equal {
    param(
        $Actual,
        $Expected,
        [string]$Message
    )

    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected' but received '$Actual'."
    }
}

function Clear-DriveOSWebEnvironment {
    Remove-Item Env:DRIVEOS_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:PORT -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_DATA_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_PUBLIC_URL -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_SESSION_HOURS -ErrorAction SilentlyContinue
}

try {
    Clear-DriveOSWebEnvironment

    Import-Module $ConfigModule -Force

    # --------------------------------------------------------
    # Desktop defaults must remain unchanged.
    # --------------------------------------------------------

    $Desktop = Get-DriveOSRuntimeConfiguration -AppRoot $Root

    Assert-Equal `
        $Desktop.Mode `
        "desktop" `
        "Runtime mode should default to desktop."

    Assert-True `
        $Desktop.IsDesktop `
        "Default runtime should identify as desktop."

    Assert-True `
        (-not $Desktop.IsWeb) `
        "Default runtime must not identify as web."

    Assert-Equal `
        $Desktop.ListenAddress `
        "127.0.0.1" `
        "Desktop listener address changed unexpectedly."

    Assert-Equal `
        $Desktop.Port `
        8787 `
        "Desktop port changed unexpectedly."

    Assert-Equal `
        $Desktop.DataDirectory `
        ([IO.Path]::GetFullPath((Join-Path $Root "data"))) `
        "Desktop data directory changed unexpectedly."

    Assert-True `
        ($null -eq $Desktop.PublicUrl) `
        "Desktop mode should not expose a public URL."

    Assert-Equal `
        $Desktop.SessionHours `
        24 `
        "Default session duration changed unexpectedly."

    # --------------------------------------------------------
    # Web mode overrides.
    # --------------------------------------------------------

    $env:DRIVEOS_MODE = "web"
    $env:PORT = "10000"
    $env:DRIVEOS_DATA_DIR = (Join-Path $Root "test-web-data")
    $env:DRIVEOS_PUBLIC_URL = "https://driveos.example.com"
    $env:DRIVEOS_SESSION_HOURS = "12"

    $Web = Get-DriveOSRuntimeConfiguration -AppRoot $Root

    Assert-Equal `
        $Web.Mode `
        "web" `
        "Web mode was not selected."

    Assert-True `
        $Web.IsWeb `
        "Web runtime should identify as web."

    Assert-True `
        (-not $Web.IsDesktop) `
        "Web runtime must not identify as desktop."

    Assert-Equal `
        $Web.ListenAddress `
        "0.0.0.0" `
        "Web mode should listen on the container interface."

    Assert-Equal `
        $Web.Port `
        10000 `
        "Web mode did not use the configured PORT."

    Assert-Equal `
        $Web.DataDirectory `
        ([IO.Path]::GetFullPath($env:DRIVEOS_DATA_DIR)) `
        "Web mode did not use DRIVEOS_DATA_DIR."

    Assert-Equal `
        $Web.PublicUrl `
        "https://driveos.example.com" `
        "Web public URL was not normalized correctly."

    Assert-Equal `
        $Web.SessionHours `
        12 `
        "Web session duration override was not applied."

    # --------------------------------------------------------
    # Invalid configuration should fail closed.
    # --------------------------------------------------------

    $env:DRIVEOS_MODE = "internet"

    $InvalidModeRejected = $false

    try {
        $null = Get-DriveOSRuntimeMode
    }
    catch {
        $InvalidModeRejected = $true
    }

    Assert-True `
        $InvalidModeRejected `
        "Invalid DRIVEOS_MODE values must be rejected."

    $env:DRIVEOS_MODE = "web"
    $env:PORT = "99999"

    $InvalidPortRejected = $false

    try {
        $null = Get-DriveOSPort
    }
    catch {
        $InvalidPortRejected = $true
    }

    Assert-True `
        $InvalidPortRejected `
        "Invalid web PORT values must be rejected."

    $env:PORT = "8787"
    $env:DRIVEOS_PUBLIC_URL = "http://driveos.example.com"

    $InsecureUrlRejected = $false

    try {
        $null = Get-DriveOSPublicUrl
    }
    catch {
        $InsecureUrlRejected = $true
    }

    Assert-True `
        $InsecureUrlRejected `
        "Web public URLs must require HTTPS."

    $env:DRIVEOS_PUBLIC_URL = "https://driveos.example.com"
    $env:DRIVEOS_SESSION_HOURS = "721"

    $InvalidSessionRejected = $false

    try {
        $null = Get-DriveOSSessionHours
    }
    catch {
        $InvalidSessionRejected = $true
    }

        Assert-True `
            $InvalidSessionRejected `
            "Invalid session duration values must be rejected."

    # --------------------------------------------------------
    # Hosted health endpoint contract.
    # --------------------------------------------------------

    $ServerPath = Join-Path $Root "DriveOS-Server.ps1"
    $ServerSource = Get-Content $ServerPath -Raw

    Assert-True `
        ($ServerSource -match '"/healthz"') `
        "DriveOS server must expose the /healthz route."

    Assert-True `
        ($ServerSource -match 'status\s*=\s*"ok"') `
        "DriveOS /healthz must return a minimal ok status."

    $HealthStart = $ServerSource.IndexOf('"/healthz"')
$NextRoute = $ServerSource.IndexOf('"/api/status"', $HealthStart)

Assert-True `
    ($HealthStart -ge 0 -and $NextRoute -gt $HealthStart) `
    "DriveOS health route boundaries could not be identified."

$HealthRouteSource = $ServerSource.Substring(
    $HealthStart,
    $NextRoute - $HealthStart
)

Assert-True `
    (-not ($HealthRouteSource -match 'Get-OverallStatus|Get-VehicleSummary|Get-SpotifySummary')) `
    "/healthz must not call provider status checks."

    Write-Host `
        "DriveOS web-hosting configuration checks passed." `
        -ForegroundColor Green
}
finally {
    Clear-DriveOSWebEnvironment
}
