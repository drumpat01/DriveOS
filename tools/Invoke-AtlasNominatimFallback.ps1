param(
    [ValidateRange(1,500)][int]$MaxCalls = 250
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDirectory = Join-Path $Root 'data'
$UserAgent = 'JourneyDeck-Atlas/5.9.39 (one-time personal mobility place migration)'
$Attribution = 'Place data (c) OpenStreetMap contributors, ODbL 1.0'

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.PlaceEnrichment.psm1') -Force

function Get-PropertyValue {
    param($Object,[string[]]$Names)
    foreach ($Name in $Names) {
        if ($Object -and $Object.PSObject.Properties[$Name]) {
            $Value = [string]$Object.$Name
            if (-not [string]::IsNullOrWhiteSpace($Value)) { return $Value.Trim() }
        }
    }
    return $null
}

function Get-CleanAddress {
    param($Result)
    $Address = $Result.address
    $HouseNumber = Get-PropertyValue $Address @('house_number')
    $Road = Get-PropertyValue $Address @('road','pedestrian','residential','footway')
    $Locality = Get-PropertyValue $Address @('city','town','village','municipality','hamlet')
    $State = Get-PropertyValue $Address @('state')
    $Postcode = Get-PropertyValue $Address @('postcode')
    $Street = if ($HouseNumber -and $Road) { "$HouseNumber $Road" } elseif ($Road) { $Road } else { $null }
    $Parts = @($Street,$Locality,$State,$Postcode) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique
    if ($Parts.Count -gt 0) { return ($Parts -join ', ') }
    return Get-PropertyValue $Result @('display_name')
}

function Resolve-NominatimPlace {
    param([double]$Latitude,[double]$Longitude)
    $Lat = $Latitude.ToString('0.########',[Globalization.CultureInfo]::InvariantCulture)
    $Lon = $Longitude.ToString('0.########',[Globalization.CultureInfo]::InvariantCulture)
    $Uri = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=$Lat&lon=$Lon"
    $Result = Invoke-RestMethod -Uri $Uri -Method Get -UserAgent $UserAgent -Headers @{ 'Accept-Language'='en-US,en;q=0.8' }
    if (-not $Result -or $Result.error) { return $null }

    $Category = [string]$Result.category
    $BusinessCategories = @('amenity','shop','tourism','leisure','office','craft','healthcare','historic','club')
    $BusinessName = if ($BusinessCategories -contains $Category) { Get-PropertyValue $Result @('name') } else { $null }
    $Address = Get-CleanAddress $Result
    $Name = if ($BusinessName) { $BusinessName } else { $Address }
    if ([string]::IsNullOrWhiteSpace($Name)) { return $null }

    return [PSCustomObject]@{
        name = $Name
        address = $Address
        category = if ($BusinessName) { Get-PropertyValue $Result @('type','category') } else { 'Address' }
        resolutionType = if ($BusinessName) { 'business' } else { 'address' }
        osmType = [string]$Result.osm_type
        osmId = [string]$Result.osm_id
    }
}

$Secrets = Get-Content (Join-Path $DataDirectory 'driveos-secrets.json') -Raw | ConvertFrom-Json
$env:TURSO_DATABASE_URL = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode Desktop
$env:TURSO_AUTH_TOKEN = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode Desktop

try {
    $Repository = New-DriveOSRepository -DataDirectory $DataDirectory -AppRoot $Root -Provider Turso
    $Drives = @(Get-DriveOSTessieDrives -Repository $Repository -Days 730)
    $Clusters = @{}
    foreach ($Drive in @($Drives | Where-Object {
        "$($_.starting_location)" -eq 'Google Timeline location' -or
        "$($_.ending_location)" -eq 'Google Timeline location' -or
        "$($_.tag)" -eq 'Reconstructed'
    })) {
        foreach ($Endpoint in @(
            @($Drive.starting_latitude,$Drive.starting_longitude),
            @($Drive.ending_latitude,$Drive.ending_longitude)
        )) {
            if ($null -eq $Endpoint[0] -or $null -eq $Endpoint[1]) { continue }
            $Latitude = [double]$Endpoint[0]
            $Longitude = [double]$Endpoint[1]
            $ClusterKey = [string]::Format([Globalization.CultureInfo]::InvariantCulture,'{0:F3},{1:F3}',$Latitude,$Longitude)
            if (-not $Clusters.ContainsKey($ClusterKey)) {
                $Clusters[$ClusterKey] = [PSCustomObject]@{key=$ClusterKey;latitude=$Latitude;longitude=$Longitude;uses=0}
            }
            $Clusters[$ClusterKey].uses++
        }
    }

    $CacheRecord = Get-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache'
    $Entries = [Collections.ArrayList]::new()
    foreach ($Entry in @($CacheRecord.entries)) { $null = $Entries.Add($Entry) }
    $EntriesByCluster = @{}
    foreach ($Entry in @($Entries)) {
        if ($null -eq $Entry.latitude -or $null -eq $Entry.longitude) { continue }
        $ClusterKey = [string]::Format([Globalization.CultureInfo]::InvariantCulture,'{0:F3},{1:F3}',[double]$Entry.latitude,[double]$Entry.longitude)
        if (-not $EntriesByCluster.ContainsKey($ClusterKey)) { $EntriesByCluster[$ClusterKey] = @() }
        $EntriesByCluster[$ClusterKey] = @($EntriesByCluster[$ClusterKey]) + $Entry
    }

    $Candidates = [Collections.ArrayList]::new()
    foreach ($Cluster in @($Clusters.Values | Sort-Object @{Expression='uses';Descending=$true})) {
        $Existing = @($EntriesByCluster[$Cluster.key])
        if (@($Existing | Where-Object status -eq 'matched').Count -gt 0) { continue }
        $Retry = @($Existing | Where-Object status -eq 'none' | Select-Object -First 1)[0]
        if ($Retry) {
            $Cluster.latitude = [double]$Retry.latitude
            $Cluster.longitude = [double]$Retry.longitude
            $Cluster | Add-Member -NotePropertyName existingKey -NotePropertyValue ([string]$Retry.key) -Force
        }
        $null = $Candidates.Add($Cluster)
    }

    $Targets = @($Candidates | Select-Object -First $MaxCalls)
    Write-Host "Atlas Nominatim fallback: $($Candidates.Count) unresolved clusters; processing $($Targets.Count)."
    $Calls = 0
    $Matched = 0
    $Businesses = 0
    $Addresses = 0
    $Misses = 0
    $Errors = 0

    foreach ($Candidate in $Targets) {
        $StartedAt = [DateTimeOffset]::UtcNow
        try {
            $Match = Resolve-NominatimPlace -Latitude $Candidate.latitude -Longitude $Candidate.longitude
            $CacheKey = if ($Candidate.PSObject.Properties['existingKey'] -and $Candidate.existingKey) {
                [string]$Candidate.existingKey
            } else {
                Get-DriveOSPlaceCacheKey -Location 'Google Timeline location' -Latitude $Candidate.latitude -Longitude $Candidate.longitude
            }
            $Entry = [PSCustomObject]@{
                key = $CacheKey
                location = 'Google Timeline location'
                latitude = [double]$Candidate.latitude
                longitude = [double]$Candidate.longitude
                status = if ($Match) { 'matched' } else { 'none' }
                name = if ($Match) { [string]$Match.name } else { $null }
                address = if ($Match) { [string]$Match.address } else { $null }
                fsqPlaceId = $null
                category = if ($Match) { [string]$Match.category } else { $null }
                distanceMeters = $null
                resolutionType = if ($Match) { [string]$Match.resolutionType } else { 'unresolved' }
                provider = 'openstreetmap'
                providerPlaceId = if ($Match) { "$($Match.osmType):$($Match.osmId)" } else { $null }
                attribution = $Attribution
                resolvedAt = [DateTimeOffset]::UtcNow.ToString('o')
            }
            $Index = -1
            for ($i=0; $i -lt $Entries.Count; $i++) { if ([string]$Entries[$i].key -eq $CacheKey) { $Index=$i; break } }
            if ($Index -ge 0) { $Entries[$Index] = $Entry } else { $null = $Entries.Add($Entry) }
            $Calls++
            if ($Match) {
                $Matched++
                if ($Match.resolutionType -eq 'business') { $Businesses++ } else { $Addresses++ }
            } else { $Misses++ }
        }
        catch {
            $Errors++
            Write-Warning "Nominatim lookup failed for cluster $($Candidate.key): $($_.Exception.Message)"
        }

        if (($Calls % 10) -eq 0 -and $Calls -gt 0) {
            Set-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache' -Value ([PSCustomObject]@{version=1;updatedAt=[DateTimeOffset]::UtcNow.ToString('o');entries=@($Entries)})
            Write-Host "Atlas Nominatim fallback: $Calls lookups saved."
        }
        $Elapsed = ([DateTimeOffset]::UtcNow - $StartedAt).TotalMilliseconds
        if ($Elapsed -lt 1100) { Start-Sleep -Milliseconds ([int](1100-$Elapsed)) }
    }

    Set-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache' -Value ([PSCustomObject]@{version=1;updatedAt=[DateTimeOffset]::UtcNow.ToString('o');entries=@($Entries)})
    [PSCustomObject]@{
        uniqueClusters = $Clusters.Count
        candidates = $Candidates.Count
        providerCalls = $Calls
        matched = $Matched
        businesses = $Businesses
        addresses = $Addresses
        misses = $Misses
        errors = $Errors
        remaining = [Math]::Max(0,$Candidates.Count-$Calls)
    }
}
finally {
    Remove-Item Env:TURSO_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TURSO_AUTH_TOKEN -ErrorAction SilentlyContinue
}
