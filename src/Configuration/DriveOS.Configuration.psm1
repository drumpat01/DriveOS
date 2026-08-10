Set-StrictMode -Version 2.0

function Get-DriveOSRuntimeMode {
    $Mode = "$($env:DRIVEOS_MODE)".Trim().ToLowerInvariant()

    if (-not $Mode) {
        return "desktop"
    }

    if ($Mode -notin @("desktop", "web")) {
        throw "DRIVEOS_MODE must be 'desktop' or 'web'."
    }

    return $Mode
}

function Get-DriveOSDataDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot
    )

    $Mode = Get-DriveOSRuntimeMode
    $ConfiguredPath = "$($env:DRIVEOS_DATA_DIR)".Trim()

    if ($Mode -eq "web" -and $ConfiguredPath) {
        return [IO.Path]::GetFullPath($ConfiguredPath)
    }

    return [IO.Path]::GetFullPath(
        (Join-Path $AppRoot "data")
    )
}

function Get-DriveOSListenAddress {
    $Mode = Get-DriveOSRuntimeMode

    if ($Mode -eq "web") {
        return "0.0.0.0"
    }

    return "127.0.0.1"
}

function Get-DriveOSPort {
    $Mode = Get-DriveOSRuntimeMode

    if ($Mode -eq "web" -and $env:PORT) {
        $Port = 0

        if (
            -not [int]::TryParse(
                "$($env:PORT)",
                [ref]$Port
            ) -or
            $Port -lt 1 -or
            $Port -gt 65535
        ) {
            throw "PORT must be an integer between 1 and 65535."
        }

        return $Port
    }

    return 8787
}

function Get-DriveOSPublicUrl {
    if ((Get-DriveOSRuntimeMode) -ne "web") {
        return $null
    }

    $Value = "$($env:DRIVEOS_PUBLIC_URL)".Trim()

    if (-not $Value -and $env:RENDER_EXTERNAL_URL) {
        $Value = "$($env:RENDER_EXTERNAL_URL)".Trim()
    }

    if (-not $Value) {
        return $null
    }

    $Uri = $null

    if (
        -not [Uri]::TryCreate(
            $Value,
            [UriKind]::Absolute,
            [ref]$Uri
        )
    ) {
        throw "DRIVEOS_PUBLIC_URL must be a valid absolute URL."
    }

    if ($Uri.Scheme -ne "https") {
        throw "DRIVEOS_PUBLIC_URL must use HTTPS."
    }

    return $Uri.GetLeftPart([UriPartial]::Authority).TrimEnd("/")
}

function Get-DriveOSSessionHours {
    $DefaultHours = 24

    if ((Get-DriveOSRuntimeMode) -ne "web") {
        return $DefaultHours
    }

    if (-not $env:DRIVEOS_SESSION_HOURS) {
        return $DefaultHours
    }

    $Hours = 0

    if (
        -not [int]::TryParse(
            "$($env:DRIVEOS_SESSION_HOURS)",
            [ref]$Hours
        ) -or
        $Hours -lt 1 -or
        $Hours -gt 720
    ) {
        throw "DRIVEOS_SESSION_HOURS must be between 1 and 720."
    }

    return $Hours
}

function Get-DriveOSRuntimeConfiguration {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppRoot
    )

    $Mode = Get-DriveOSRuntimeMode

    return [PSCustomObject]@{
        Mode         = $Mode
        IsDesktop    = ($Mode -eq "desktop")
        IsWeb        = ($Mode -eq "web")
        ListenAddress = Get-DriveOSListenAddress
        Port         = Get-DriveOSPort
        DataDirectory = Get-DriveOSDataDirectory -AppRoot $AppRoot
        PublicUrl    = Get-DriveOSPublicUrl
        SessionHours = Get-DriveOSSessionHours
    }
}

Export-ModuleMember -Function `
    Get-DriveOSRuntimeMode, `
    Get-DriveOSDataDirectory, `
    Get-DriveOSListenAddress, `
    Get-DriveOSPort, `
    Get-DriveOSPublicUrl, `
    Get-DriveOSSessionHours, `
    Get-DriveOSRuntimeConfiguration
