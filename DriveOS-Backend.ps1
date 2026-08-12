param(
    [Parameter(Mandatory=$true)]
    [ValidateRange(1, 2147483647)]
    [int]$ParentPid
)

$ErrorActionPreference = "Stop"

$DataDirectory = Join-Path $PSScriptRoot "data"
$SecretFile = Join-Path $DataDirectory "driveos-secrets.json"
$ServerFile = Join-Path $PSScriptRoot "DriveOS-Server.ps1"
$LogFile = Join-Path $DataDirectory "driveos-backend.log"

function Write-DriveOSBackendLog {
    param([string]$Message)

    try {
        $SafeMessage = "$Message"

        foreach ($Secret in @(
            $env:TESSIE_TOKEN,
            $env:SPOTIFY_CLIENT_ID,
            $env:DRIVEOS_SESSION_TOKEN,
            $env:TURSO_DATABASE_URL,
            $env:TURSO_AUTH_TOKEN
        )) {
            if ($Secret) {
                $SafeMessage = $SafeMessage.Replace($Secret, "[REDACTED]")
            }
        }

        $Stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        "$Stamp  $SafeMessage" | Add-Content -Path $LogFile -Encoding UTF8
    }
    catch {}
}

function Unprotect-DriveOSSecret {
    param([Parameter(Mandatory=$true)][string]$EncryptedValue)

    $SecureString = ConvertTo-SecureString $EncryptedValue
    $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)

    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
}

try {
    if (-not (Test-Path $DataDirectory)) {
        New-Item -ItemType Directory -Path $DataDirectory | Out-Null
    }

    "" | Set-Content -Path $LogFile -Encoding UTF8

    if (-not $env:DRIVEOS_SESSION_TOKEN -or
        $env:DRIVEOS_SESSION_TOKEN -notmatch "^[0-9a-f]{64}$") {
        Write-DriveOSBackendLog "Missing or invalid DriveOS local-session credential."
        exit 30
    }

    if (-not $env:DRIVEOS_PARENT_START_TICKS -or
        $env:DRIVEOS_PARENT_START_TICKS -notmatch "^\d+$") {
        Write-DriveOSBackendLog "Missing DriveOS parent-process identity."
        exit 31
    }

    if (-not (Test-Path $SecretFile)) {
        Write-DriveOSBackendLog "Encrypted DriveOS secret cache is missing."
        exit 32
    }

    if (-not (Test-Path $ServerFile)) {
        Write-DriveOSBackendLog "DriveOS-Server.ps1 is missing."
        exit 33
    }

    # Validate the parent before decrypting any long-lived credentials.
    try {
        $Parent = Get-Process -Id $ParentPid -ErrorAction Stop
        $ExpectedTicks = [Int64]$env:DRIVEOS_PARENT_START_TICKS
        $ActualTicks = $Parent.StartTime.ToUniversalTime().Ticks

        if ($ActualTicks -ne $ExpectedTicks) {
            throw "Parent process identity did not match."
        }
    }
    catch {
        Write-DriveOSBackendLog "DriveOS parent process validation failed."
        exit 34
    }

    $Secrets = Get-Content $SecretFile -Raw | ConvertFrom-Json

    $env:TESSIE_TOKEN = Unprotect-DriveOSSecret $Secrets.TessieToken
    $env:SPOTIFY_CLIENT_ID = Unprotect-DriveOSSecret $Secrets.SpotifyClientId

    if (
        $Secrets.PSObject.Properties['TursoDatabaseUrl'] -and
        $Secrets.PSObject.Properties['TursoAuthToken'] -and
        $Secrets.TursoDatabaseUrl -and
        $Secrets.TursoAuthToken
    ) {
        $env:DRIVEOS_REPOSITORY_PROVIDER = "Turso"
        $env:TURSO_DATABASE_URL = Unprotect-DriveOSSecret $Secrets.TursoDatabaseUrl
        $env:TURSO_AUTH_TOKEN = Unprotect-DriveOSSecret $Secrets.TursoAuthToken
        Write-DriveOSBackendLog "Repository provider: Turso"
    }
    else {
        Write-DriveOSBackendLog "Turso credentials were not present."
    }
    & $ServerFile `
        -ParentPid $ParentPid `
        -ParentStartTicks ([Int64]$env:DRIVEOS_PARENT_START_TICKS)
}
catch {
    Write-DriveOSBackendLog $_.Exception.ToString()
    exit 35
}
finally {
    Remove-Item Env:TESSIE_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:SPOTIFY_CLIENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_REPOSITORY_PROVIDER -ErrorAction SilentlyContinue
    Remove-Item Env:TURSO_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TURSO_AUTH_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_SESSION_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:DRIVEOS_PARENT_START_TICKS -ErrorAction SilentlyContinue
}
