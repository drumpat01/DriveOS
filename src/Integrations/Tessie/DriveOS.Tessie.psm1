Set-StrictMode -Version 2.0

function New-TessieClient {
    param([Parameter(Mandatory=$true)][string]$Token, [string]$BaseUri = "https://api.tessie.com")
    [PSCustomObject]@{ BaseUri = $BaseUri.TrimEnd('/'); Headers = @{ Authorization = "Bearer $Token" } }
}

function Invoke-TessieGet {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$PathAndQuery)
    Invoke-RestMethod -Uri ($Client.BaseUri + "/" + $PathAndQuery.TrimStart('/')) -Headers $Client.Headers -Method Get
}

function Invoke-TessiePost {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Path,
        [hashtable]$Query = @{}
    )

    $pairs = @()
    foreach ($Key in $Query.Keys) {
        if ($null -ne $Query[$Key]) {
            $pairs += ("{0}={1}" -f [Uri]::EscapeDataString([string]$Key), [Uri]::EscapeDataString([string]$Query[$Key]))
        }
    }

    $suffix = if ($pairs.Count) { "?" + ($pairs -join "&") } else { "" }
    Invoke-RestMethod -Uri ($Client.BaseUri + "/" + $Path.TrimStart('/') + $suffix) -Headers $Client.Headers -Method Post
}

function Get-TessieVehicle {
    param([Parameter(Mandatory=$true)]$Client)
    $response = Invoke-TessieGet -Client $Client -PathAndQuery "vehicles"
    return $response.results | Select-Object -First 1
}

function Get-TessieHistoryRange {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$Vin,
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges','states')][string]$Resource,
        [Parameter(Mandatory=$true)][long]$From, [Parameter(Mandatory=$true)][long]$To,
        [string]$ExtraQuery = "")
    $query = "from=$From&to=$To"
    if ($ExtraQuery) { $query += "&" + $ExtraQuery.TrimStart('&') }
    Invoke-TessieGet -Client $Client -PathAndQuery "$Vin/$Resource`?$query"
}

function Start-TessieClimate {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$Vin)
    Invoke-TessiePost -Client $Client -Path "$Vin/command/start_climate" -Query @{ wait_for_completion = 'true'; max_attempts = '1' }
}

function Share-TessieDestination {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Vin,
        [Parameter(Mandatory=$true)][string]$Value,
        [string]$Locale = 'en-US'
    )

    $Destination = $Value.Trim()
    if (-not $Destination -or $Destination.Length -gt 512) {
        throw 'A valid saved destination is required.'
    }

    Invoke-TessiePost -Client $Client -Path "$Vin/command/share" -Query @{
        value = $Destination; locale = $Locale; wait_for_completion = 'true'; max_attempts = '1'
    }
}

Export-ModuleMember -Function New-TessieClient,Invoke-TessieGet,Invoke-TessiePost,Get-TessieVehicle,Get-TessieHistoryRange,Start-TessieClimate,Share-TessieDestination
