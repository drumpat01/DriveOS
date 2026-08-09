Set-StrictMode -Version 2.0

function New-FoursquareClient {
    param(
        [Parameter(Mandatory=$true)][string]$ApiKey,
        [string]$ApiBaseUri = "https://places-api.foursquare.com",
        [string]$ApiVersion = "2025-06-17"
    )

    [PSCustomObject]@{
        ApiBaseUri = $ApiBaseUri.TrimEnd('/')
        Headers = @{
            Authorization = "Bearer $($ApiKey.Trim())"
            "X-Places-Api-Version" = $ApiVersion
            Accept = "application/json"
        }
    }
}

function Invoke-FoursquareGet {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$Path,
        [hashtable]$Parameters = @{}
    )

    $Pairs = @($Parameters.GetEnumerator() | Sort-Object Key | ForEach-Object {
        "{0}={1}" -f [Uri]::EscapeDataString([string]$_.Key), [Uri]::EscapeDataString([string]$_.Value)
    })
    $Uri = $Client.ApiBaseUri + "/" + $Path.TrimStart('/')
    if ($Pairs.Count -gt 0) { $Uri += "?" + ($Pairs -join "&") }

    Invoke-RestMethod -Uri $Uri -Method Get -Headers $Client.Headers
}

function ConvertTo-DriveOSFoursquarePlace {
    param([Parameter(Mandatory=$true)]$Place)

    $Category = $null
    if ($Place.PSObject.Properties['categories'] -and @($Place.categories).Count -gt 0) {
        $Category = [string]@($Place.categories)[0].name
    }

    $Address = $null
    if ($Place.PSObject.Properties['location'] -and $Place.location) {
        if ($Place.location.PSObject.Properties['formatted_address']) {
            $Address = [string]$Place.location.formatted_address
        }
        elseif ($Place.location.PSObject.Properties['address']) {
            $Address = [string]$Place.location.address
        }
    }

    [PSCustomObject]@{
        id             = [string]$Place.fsq_place_id
        name           = [string]$Place.name
        distanceMeters = if ($null -ne $Place.distance) { [double]$Place.distance } else { $null }
        latitude       = if ($null -ne $Place.latitude) { [double]$Place.latitude } else { $null }
        longitude      = if ($null -ne $Place.longitude) { [double]$Place.longitude } else { $null }
        category       = $Category
        address        = $Address
    }
}

function Search-FoursquarePlaces {
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][ValidateRange(-90,90)][double]$Latitude,
        [Parameter(Mandatory=$true)][ValidateRange(-180,180)][double]$Longitude,
        [ValidateRange(1,1000)][int]$RadiusMeters = 100,
        [ValidateRange(1,10)][int]$Limit = 5
    )

    $Response = Invoke-FoursquareGet -Client $Client -Path "places/search" -Parameters @{
        ll = ([string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0},{1}", $Latitude, $Longitude))
        radius = $RadiusMeters
        limit = $Limit
        sort = "DISTANCE"
        fields = "fsq_place_id,name,latitude,longitude,location,categories,distance"
    }

    $Results = @()
    if ($Response -and $Response.PSObject.Properties['results']) { $Results = @($Response.results) }
    return @($Results | ForEach-Object { ConvertTo-DriveOSFoursquarePlace -Place $_ })
}

Export-ModuleMember -Function New-FoursquareClient,Invoke-FoursquareGet,ConvertTo-DriveOSFoursquarePlace,Search-FoursquarePlaces
