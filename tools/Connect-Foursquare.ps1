$ErrorActionPreference = "Stop"

# The Service API key is encrypted with Windows DPAPI and never sent to the
# DriveOS browser UI. No network call is made here, preserving the free quota.

$Root = Split-Path -Parent $PSScriptRoot
$DataDirectory = Join-Path $Root "data"
$ConfigFile = Join-Path $DataDirectory "foursquare-config.json"

function ConvertFrom-SecureInput {
    param([Parameter(Mandatory=$true)][Security.SecureString]$Value)
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
}

function Protect-DriveOSPrivateFileAcl {
    param([Parameter(Mandatory=$true)][string]$Path)
    try {
        $UserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $SystemSid = New-Object Security.Principal.SecurityIdentifier(
            [Security.Principal.WellKnownSidType]::LocalSystemSid, $null
        )
        $Acl = New-Object Security.AccessControl.FileSecurity
        $Acl.SetOwner($UserSid)
        $Acl.SetAccessRuleProtection($true, $false)
        $Inheritance = [Security.AccessControl.InheritanceFlags]::None
        $Propagation = [Security.AccessControl.PropagationFlags]::None
        $Allow = [Security.AccessControl.AccessControlType]::Allow
        $Rights = [Security.AccessControl.FileSystemRights]::FullControl
        foreach ($Sid in @($UserSid, $SystemSid)) {
            $Acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
                $Sid, $Rights, $Inheritance, $Propagation, $Allow
            )))
        }
        Set-Acl -Path $Path -AclObject $Acl
        return $true
    }
    catch {
        Write-Warning "DriveOS could not tighten the file ACL. DPAPI encryption is still active."
        return $false
    }
}

Clear-Host
Write-Host "DriveOS + Foursquare" -ForegroundColor Cyan
Write-Host "--------------------" -ForegroundColor DarkCyan
Write-Host "This lets DriveOS recognize business names at repeated drive locations."
Write-Host "Only unknown repeated locations are checked. Home, Work, and all other names you save are never sent."
Write-Host "DriveOS stops at 10 searches per day and 250 per month, then reuses its local cache."
Write-Host "No API call is used by this setup screen."
Write-Host ""

$SecureApiKey = Read-Host "Foursquare Service API key (input is hidden)" -AsSecureString
$ApiKey = ConvertFrom-SecureInput -Value $SecureApiKey
if (-not $ApiKey -or $ApiKey.Trim().Length -lt 12) { throw "A valid Foursquare Service API key is required." }

if (-not (Test-Path $DataDirectory)) { New-Item -ItemType Directory -Path $DataDirectory | Out-Null }
$Payload = [PSCustomObject]@{
    Version = 1
    ApiKey = ($ApiKey.Trim() | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString)
    UpdatedAt = (Get-Date).ToString("o")
}
$Payload | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
$AclHardened = Protect-DriveOSPrivateFileAcl -Path $ConfigFile
$ApiKey = $null

Write-Host ""
Write-Host "Foursquare is connected to DriveOS." -ForegroundColor Green
Write-Host "The first Refresh data will safely identify up to 10 of your most-visited unknown locations." -ForegroundColor Green
Write-Host "Matched business names are cached and do not use another search." -ForegroundColor Cyan
if ($AclHardened) {
    Write-Host "The local configuration is restricted to your Windows account and SYSTEM." -ForegroundColor DarkGreen
}
Write-Host ""
Read-Host "Press Enter to close"
