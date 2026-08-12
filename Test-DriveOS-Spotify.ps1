$ErrorActionPreference = "Stop"

$TokenPath = Join-Path $PSScriptRoot "data\spotify-token.json"

if (-not (Test-Path $TokenPath -PathType Leaf)) {
    throw "Spotify token file not found: $TokenPath"
}

$Cache = Get-Content $TokenPath -Raw | ConvertFrom-Json
$Secure = ConvertTo-SecureString $Cache.AccessToken
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)

try {
    $AccessToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)

    try {
        $Response = Invoke-WebRequest `
            -Uri "https://api.spotify.com/v1/me/player/recently-played?limit=50" `
            -Headers @{ Authorization = "Bearer $AccessToken" } `
            -Method Get `
            -UseBasicParsing

        Write-Host ""
        Write-Host "Spotify request succeeded." -ForegroundColor Green
        Write-Host "HTTP status: $($Response.StatusCode)"
    }
    catch {
        Write-Host ""
        Write-Host "Spotify request failed." -ForegroundColor Red
        Write-Host "Exception: $($_.Exception.Message)"

        if ($_.Exception.Response) {
            try {
                Write-Host "HTTP status: $([int]$_.Exception.Response.StatusCode)"
            }
            catch {}

            try {
                $Reader = New-Object System.IO.StreamReader(
                    $_.Exception.Response.GetResponseStream()
                )
                $Body = $Reader.ReadToEnd()
                $Reader.Dispose()

                if ($Body) {
                    Write-Host "Spotify response body:"
                    Write-Host $Body
                }
            }
            catch {}
        }
    }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    Remove-Variable AccessToken -ErrorAction SilentlyContinue
}
