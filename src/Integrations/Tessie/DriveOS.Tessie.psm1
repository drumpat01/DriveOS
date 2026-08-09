Set-StrictMode -Version 2.0

function New-TessieClient {
    param([Parameter(Mandatory=$true)][string]$Token, [string]$BaseUri = "https://api.tessie.com")
    [PSCustomObject]@{ BaseUri = $BaseUri.TrimEnd('/'); Headers = @{ Authorization = "Bearer $Token" } }
}

function Invoke-TessieGet {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$PathAndQuery)
    Invoke-RestMethod -Uri ($Client.BaseUri + "/" + $PathAndQuery.TrimStart('/')) -Headers $Client.Headers -Method Get
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

Export-ModuleMember -Function New-TessieClient,Invoke-TessieGet,Get-TessieVehicle,Get-TessieHistoryRange
