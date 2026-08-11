$ErrorActionPreference = "Stop"

function New-DriveOSRandomBase64Secret {
    param([int]$Bytes = 32)

    $Buffer = New-Object byte[] $Bytes
    $Random = [Security.Cryptography.RandomNumberGenerator]::Create()

    try {
        $Random.GetBytes($Buffer)
    }
    finally {
        $Random.Dispose()
    }

    return [Convert]::ToBase64String($Buffer)
}

Write-Host ""
Write-Host "Generate these values once and store them only in your hosting environment." -ForegroundColor Cyan
Write-Host "Do not commit them to GitHub." -ForegroundColor Yellow
Write-Host ""
Write-Host "DRIVEOS_AUTH_SECRET="
Write-Host (New-DriveOSRandomBase64Secret -Bytes 32)
Write-Host ""
Write-Host "DRIVEOS_ENCRYPTION_KEY="
Write-Host (New-DriveOSRandomBase64Secret -Bytes 32)
Write-Host ""