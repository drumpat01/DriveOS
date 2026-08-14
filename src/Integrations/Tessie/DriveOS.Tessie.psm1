Set-StrictMode -Version 2.0

function New-TessieClient {
    param(
        [Parameter(Mandatory=$true)][string]$Token,
        [string]$BaseUri = "https://api.tessie.com",
        [ValidateRange(1,300)][int]$TimeoutSeconds = 30
    )
    [PSCustomObject]@{
        BaseUri = $BaseUri.TrimEnd('/')
        Headers = @{ Authorization = "Bearer $Token" }
        TimeoutSeconds = $TimeoutSeconds
    }
}

function Invoke-TessieGet {
    param([Parameter(Mandatory=$true)]$Client, [Parameter(Mandatory=$true)][string]$PathAndQuery)
    Invoke-RestMethod `
        -Uri ($Client.BaseUri + "/" + $PathAndQuery.TrimStart('/')) `
        -Headers $Client.Headers `
        -Method Get `
        -TimeoutSec $Client.TimeoutSeconds
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

function Get-TessieCompleteHistoryRange {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Vin,
        [Parameter(Mandatory=$true)][ValidateSet('drives','charges')][string]$Resource,
        [Parameter(Mandatory=$true)][long]$From,
        [Parameter(Mandatory=$true)][long]$To,
        [string]$ExtraQuery = '',
        [ValidateRange(1,1000)][int]$Limit = 1000,
        [ValidateRange(1,3600)][int]$MinimumWindowSeconds = 60,
        [ValidateRange(2,512)][int]$MaximumRequests = 128,
        [scriptblock]$Request
    )

    if ($To -lt $From) { throw 'Tessie history range end must not precede its start.' }
    if (-not $Request) {
        $Request = {
            param($RequestClient,$RequestVin,$RequestResource,$RequestFrom,$RequestTo,$RequestExtraQuery)
            Get-TessieHistoryRange -Client $RequestClient -Vin $RequestVin -Resource $RequestResource -From $RequestFrom -To $RequestTo -ExtraQuery $RequestExtraQuery
        }
    }

    $ProviderQuery = "limit=$Limit"
    if ($ExtraQuery) { $ProviderQuery += '&' + $ExtraQuery.TrimStart('&') }
    $Pending = New-Object System.Collections.ArrayList
    $null = $Pending.Add([PSCustomObject]@{ From=$From; To=$To })
    $Accepted = @()
    $Requests = 0
    $Windows = 0

    while ($Pending.Count -gt 0) {
        if ($Requests -ge $MaximumRequests) {
            throw "Tessie $Resource history exceeded the $MaximumRequests request safety limit."
        }
        $Window = $Pending[0]
        $Pending.RemoveAt(0)
        $Requests++
        $Response = & $Request $Client $Vin $Resource ([long]$Window.From) ([long]$Window.To) $ProviderQuery
        $Results = @($Response.results)

        if ($Results.Count -ge $Limit) {
            $Duration = [long]$Window.To - [long]$Window.From
            if ($Duration -le $MinimumWindowSeconds) {
                throw "Tessie $Resource history still reached its $Limit-result limit in a $Duration-second window; the cursor was not advanced."
            }
            $Midpoint = [long]([math]::Floor(([double]$Window.From + [double]$Window.To) / 2))
            if ($Midpoint -le [long]$Window.From -or $Midpoint -ge [long]$Window.To) {
                throw "Tessie $Resource history window could not be split safely; the cursor was not advanced."
            }
            $null = $Pending.Insert(0,[PSCustomObject]@{ From=$Midpoint + 1; To=[long]$Window.To })
            $null = $Pending.Insert(0,[PSCustomObject]@{ From=[long]$Window.From; To=$Midpoint })
            continue
        }

        $Windows++
        $Accepted += $Results
    }

    $ByIdentity = @{}
    foreach ($Record in @($Accepted)) {
        $IdProperty = $Record.PSObject.Properties['id']
        $Identity = if ($IdProperty -and $null -ne $IdProperty.Value -and "$($IdProperty.Value)".Trim()) {
            "id:$($IdProperty.Value)"
        }
        else {
            "time:$($Record.started_at):$($Record.ended_at)"
        }
        $ByIdentity[$Identity] = $Record
    }

    return [PSCustomObject]@{
        results = @($ByIdentity.Values | Sort-Object started_at -Descending)
        requestCount = $Requests
        acceptedWindowCount = $Windows
    }
}

Export-ModuleMember -Function New-TessieClient,Invoke-TessieGet,Get-TessieVehicle,Get-TessieHistoryRange,Get-TessieCompleteHistoryRange
