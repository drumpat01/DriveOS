$ErrorActionPreference = 'Stop'

$envPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envPath) {
  Write-Host 'Existing .env preserved. Run docker compose up -d to start xprem.'
  exit 0
}

function New-RandomHex([int]$bytes) {
  [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)).ToLowerInvariant()
}

$dbPassword = New-RandomHex 24
$jwtSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$masterKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$adminPassword = "Aa1!$(New-RandomHex 18)"

@(
  "XPREM_POSTGRES_PASSWORD=$dbPassword"
  "JWT_SECRET=$jwtSecret"
  "DB_KEYS_MASTER_KEY_B64=$masterKey"
  'ADMIN_EMAIL=admin@localhost.test'
  "ADMIN_PASSWORD=$adminPassword"
) | Set-Content -LiteralPath $envPath -Encoding utf8

Write-Host 'Created ignored .env with local dashboard credentials and encryption keys. Back it up with the Docker volumes.'
