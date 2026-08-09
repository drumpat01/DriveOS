$ErrorActionPreference = "Stop"

# Last.fm exposes listening history through a read-only API key. DriveOS stores
# that key with Windows DPAPI, tied to the current Windows account, and never
# sends it to the browser.

$Root = Split-Path -Parent $PSScriptRoot
$DataDirectory = Join-Path $Root "data"
$ConfigFile = Join-Path $DataDirectory "lastfm-config.json"

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
            [Security.Principal.WellKnownSidType]::LocalSystemSid,
            $null
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
Write-Host "DriveOS + Last.fm" -ForegroundColor Cyan
Write-Host "-----------------" -ForegroundColor DarkCyan
Write-Host "This connects DriveOS to your read-only Last.fm listening history."
Write-Host "Your API key is encrypted locally and is never shown inside DriveOS."
Write-Host ""

$Username = (Read-Host "Last.fm username").Trim()
if (-not $Username) { throw "A Last.fm username is required." }

$SecureApiKey = Read-Host "Last.fm API key (input is hidden)" -AsSecureString
$ApiKey = ConvertFrom-SecureInput -Value $SecureApiKey
if (-not $ApiKey) { throw "A Last.fm API key is required." }

Write-Host ""
Write-Host "Checking Last.fm..." -ForegroundColor Yellow
$Query = "https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user={0}&api_key={1}&format=json&limit=1" -f `
    [Uri]::EscapeDataString($Username), [Uri]::EscapeDataString($ApiKey)
try {
    $Response = Invoke-RestMethod -Uri $Query -Method Get
}
catch {
    throw "DriveOS could not verify that Last.fm username and API key. Check them and try again."
}
$Query = $null

if ($Response.error) {
    throw "Last.fm rejected the connection: $($Response.message)"
}

if (-not (Test-Path $DataDirectory)) {
    New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

$Payload = [PSCustomObject]@{
    Version   = 1
    Username  = $Username
    ApiKey    = ($ApiKey | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString)
    UpdatedAt = (Get-Date).ToString("o")
}

$Payload | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
$AclHardened = Protect-DriveOSPrivateFileAcl -Path $ConfigFile
$ApiKey = $null

Write-Host ""
Write-Host "Last.fm is connected to DriveOS." -ForegroundColor Green
Write-Host "Listening history will sync during startup and Refresh data." -ForegroundColor Green
Write-Host "Saved for Last.fm user: $Username" -ForegroundColor Cyan
if ($AclHardened) {
    Write-Host "The local configuration is restricted to your Windows account and SYSTEM." -ForegroundColor DarkGreen
}
Write-Host ""
Read-Host "Press Enter to close"
