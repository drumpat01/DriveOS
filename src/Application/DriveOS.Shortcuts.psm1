Set-StrictMode -Version 2.0

Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'Storage\DriveOS.Storage.psm1')

function New-DriveOSShortcutToken {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

function Get-DriveOSShortcutConfig {
    param([Parameter(Mandatory=$true)][string]$Path)

    $config = Read-DriveOSJson -Path $Path -Default $null
    $enabled = [bool]($config -and $config.enabled -and ([string]$config.token) -match '^[0-9a-f]{64}$')
    return [pscustomobject]@{
        version = 1
        enabled = $enabled
        token = if ($enabled) { [string]$config.token } else { $null }
        createdAt = if ($config) { [string]$config.createdAt } else { $null }
        rotatedAt = if ($config) { [string]$config.rotatedAt } else { $null }
    }
}

function Enable-DriveOSShortcuts {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [switch]$Rotate
    )

    $existing = Get-DriveOSShortcutConfig -Path $Path
    if ($existing.enabled -and -not $Rotate) { return $existing }

    $now = (Get-Date).ToUniversalTime().ToString('o')
    $config = [pscustomobject]@{
        version = 1
        enabled = $true
        token = New-DriveOSShortcutToken
        createdAt = if ($existing.createdAt) { $existing.createdAt } else { $now }
        rotatedAt = $now
    }
    Write-DriveOSJson -Path $Path -Value $config
    return Get-DriveOSShortcutConfig -Path $Path
}

function Disable-DriveOSShortcuts {
    param([Parameter(Mandatory=$true)][string]$Path)

    $existing = Get-DriveOSShortcutConfig -Path $Path
    $config = [pscustomobject]@{
        version = 1
        enabled = $false
        token = $null
        createdAt = $existing.createdAt
        rotatedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-DriveOSJson -Path $Path -Value $config
    return Get-DriveOSShortcutConfig -Path $Path
}

function Test-DriveOSShortcutToken {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [AllowNull()][string]$Token
    )

    $config = Get-DriveOSShortcutConfig -Path $Path
    if (-not $config.enabled -or -not $Token -or $Token -notmatch '^[0-9a-f]{64}$') { return $false }

    $left = [Text.Encoding]::UTF8.GetBytes($Token)
    $right = [Text.Encoding]::UTF8.GetBytes([string]$config.token)
    $difference = $left.Length -bxor $right.Length
    $maximum = [Math]::Max($left.Length, $right.Length)
    for ($index = 0; $index -lt $maximum; $index++) {
        $leftByte = if ($index -lt $left.Length) { $left[$index] } else { 0 }
        $rightByte = if ($index -lt $right.Length) { $right[$index] } else { 0 }
        $difference = $difference -bor ($leftByte -bxor $rightByte)
    }
    return $difference -eq 0
}

Export-ModuleMember -Function New-DriveOSShortcutToken,Get-DriveOSShortcutConfig,Enable-DriveOSShortcuts,Disable-DriveOSShortcuts,Test-DriveOSShortcutToken
