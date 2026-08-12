$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DataDirectory = Join-Path $Root "data"
$SecretFile = Join-Path $DataDirectory "driveos-secrets.json"

if (-not (Test-Path -LiteralPath $SecretFile -PathType Leaf)) {
    throw "DriveOS encrypted secrets do not exist yet. Run the normal DriveOS secret setup first."
}

function Protect-DriveOSSecret {
    param([Parameter(Mandatory=$true)][string]$Value)

    return $Value |
        ConvertTo-SecureString -AsPlainText -Force |
        ConvertFrom-SecureString
}

function ConvertFrom-SecurePrompt {
    param([Parameter(Mandatory=$true)][Security.SecureString]$SecureValue)

    $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BSTR)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
    }
}

$DefaultUrl = "libsql://driveos-drumpat01.aws-us-east-2.turso.io"
$EnteredUrl = Read-Host "Turso database URL [$DefaultUrl]"
if (-not $EnteredUrl) {
    $EnteredUrl = $DefaultUrl
}

$SecureToken = Read-Host "Turso auth token (input is hidden)" -AsSecureString
$PlainToken = ConvertFrom-SecurePrompt -SecureValue $SecureToken

if (-not $PlainToken) {
    throw "A Turso auth token is required."
}

$Secrets = Get-Content -LiteralPath $SecretFile -Raw | ConvertFrom-Json

$NewSecrets = [ordered]@{}
foreach ($Property in $Secrets.PSObject.Properties) {
    $NewSecrets[$Property.Name] = $Property.Value
}

$NewSecrets["Version"] = 2
$NewSecrets["TursoDatabaseUrl"] = Protect-DriveOSSecret $EnteredUrl
$NewSecrets["TursoAuthToken"] = Protect-DriveOSSecret $PlainToken

$NewSecrets |
    ConvertTo-Json |
    Set-Content -LiteralPath $SecretFile -Encoding UTF8

$PlainToken = $null
Remove-Variable SecureToken -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Turso credentials added to DriveOS's DPAPI-encrypted local secret cache." -ForegroundColor Green
Write-Host "Desktop DriveOS will now use Turso when launched normally." -ForegroundColor Green
Write-Host ""
