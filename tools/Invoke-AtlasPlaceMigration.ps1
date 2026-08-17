param(
    [ValidateRange(1,2000)][int]$MaxCalls = 500,
    [switch]$AllowBillableCalls,
    [Nullable[double]]$HomeLatitude,
    [Nullable[double]]$HomeLongitude,
    [ValidateRange(1,5280)][int]$HomeRadiusFeet = 200
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$DataDirectory = Join-Path $Root 'data'
$HasHomeCoordinates = $null -ne $HomeLatitude -and $null -ne $HomeLongitude
if (($null -ne $HomeLatitude) -xor ($null -ne $HomeLongitude)) {
    throw 'HomeLatitude and HomeLongitude must be supplied together.'
}
if ($HasHomeCoordinates -and ($HomeLatitude -lt -90 -or $HomeLatitude -gt 90 -or $HomeLongitude -lt -180 -or $HomeLongitude -gt 180)) {
    throw 'Home coordinates are outside the valid latitude and longitude ranges.'
}

Import-Module (Join-Path $Root 'src\Storage\DriveOS.Storage.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
Import-Module (Join-Path $Root 'src\Repositories\DriveOS.Repository.psm1') -Force
Import-Module (Join-Path $Root 'src\Integrations\Foursquare\DriveOS.Foursquare.psm1') -Force
Import-Module (Join-Path $Root 'src\Application\DriveOS.PlaceEnrichment.psm1') -Force

function Get-DistanceMiles([double]$LatitudeA,[double]$LongitudeA,[double]$LatitudeB,[double]$LongitudeB) {
    $Radians = [Math]::PI / 180
    $LatDelta = ($LatitudeB - $LatitudeA) * $Radians
    $LonDelta = ($LongitudeB - $LongitudeA) * $Radians
    $Value = [Math]::Sin($LatDelta/2) * [Math]::Sin($LatDelta/2) +
        [Math]::Cos($LatitudeA*$Radians) * [Math]::Cos($LatitudeB*$Radians) *
        [Math]::Sin($LonDelta/2) * [Math]::Sin($LonDelta/2)
    return 3958.7613 * 2 * [Math]::Atan2([Math]::Sqrt($Value),[Math]::Sqrt(1-$Value))
}

$Secrets = Get-Content (Join-Path $DataDirectory 'driveos-secrets.json') -Raw | ConvertFrom-Json
$FoursquareConfig = Get-Content (Join-Path $DataDirectory 'foursquare-config.json') -Raw | ConvertFrom-Json
$env:TURSO_DATABASE_URL = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode Desktop
$env:TURSO_AUTH_TOKEN = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode Desktop
$ApiKey = Unprotect-DriveOSSecret -ProtectedText $FoursquareConfig.ApiKey -Mode Desktop

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
            $Latitude = [double]$Endpoint[0]; $Longitude = [double]$Endpoint[1]
            $ClusterKey = [string]::Format([Globalization.CultureInfo]::InvariantCulture,'{0:F3},{1:F3}',$Latitude,$Longitude)
            if (-not $Clusters.ContainsKey($ClusterKey)) {
                $Clusters[$ClusterKey] = [PSCustomObject]@{latitude=$Latitude;longitude=$Longitude;uses=0}
            }
            $Clusters[$ClusterKey].uses++
        }
    }

    $CacheRecord = Get-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache'
    $Entries = [Collections.ArrayList]::new()
    foreach ($Entry in @($CacheRecord.entries)) { $null = $Entries.Add($Entry) }
    $CacheMap = @{}; foreach ($Entry in @($Entries)) { if ($Entry.key) { $CacheMap[[string]$Entry.key] = $Entry } }
    $UsageRecord = Get-DriveOSTursoState -Repository $Repository -Key 'foursquare-usage'
    $Usage = Get-DriveOSFoursquareUsageWindow -Usage $UsageRecord -DailyLimit 500 -MonthlyLimit 500
    $StartingMonthCount = [int]$Usage.monthCount
    $NewUsage = [PSCustomObject]@{version=1;day=$Usage.day;dayCount=[int]$Usage.dayCount;month=$Usage.month;monthCount=[int]$Usage.monthCount;lastError=$null;lastErrorAt=$null;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
    $CallBudget = if ($AllowBillableCalls) { $MaxCalls } else { [Math]::Min($MaxCalls,[int]$Usage.monthRemaining) }
    $Client = New-FoursquareClient -ApiKey $ApiKey
    $Calls = 0; $Resolved = 0; $Addresses = 0; $Businesses = 0; $Manual = 0; $Misses = 0
    $OrderedClusters = @($Clusters.Values | Sort-Object @{Expression='uses';Descending=$true})

    foreach ($Cluster in $OrderedClusters) {
        $CacheKey = Get-DriveOSPlaceCacheKey -Location 'Google Timeline location' -Latitude $Cluster.latitude -Longitude $Cluster.longitude
        if ($CacheMap.ContainsKey($CacheKey)) { continue }
        $DistanceFromHome = if ($HasHomeCoordinates) { Get-DistanceMiles $Cluster.latitude $Cluster.longitude $HomeLatitude $HomeLongitude } else { [double]::PositiveInfinity }
        if ($DistanceFromHome -le ($HomeRadiusFeet/5280.0)) {
            $Entry = [PSCustomObject]@{key=$CacheKey;location='Google Timeline location';latitude=$Cluster.latitude;longitude=$Cluster.longitude;status='matched';name='Home';address='Home';fsqPlaceId=$null;category='Home';distanceMeters=0;resolutionType='manual';resolvedAt=[DateTimeOffset]::UtcNow.ToString('o')}
            $null=$Entries.Add($Entry);$CacheMap[$CacheKey]=$Entry;$Manual++;$Resolved++
            continue
        }
        if ($Calls -ge $CallBudget) { break }

        # Reserve and durably record each provider call before issuing it. If
        # the process is interrupted, a rerun cannot reuse the same free-call
        # allowance and accidentally cross the non-billable boundary.
        $NewUsage = [PSCustomObject]@{version=1;day=$Usage.day;dayCount=([int]$Usage.dayCount+$Calls+1);month=$Usage.month;monthCount=([int]$Usage.monthCount+$Calls+1);lastError=$null;lastErrorAt=$null;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
        Set-DriveOSTursoState -Repository $Repository -Key 'foursquare-usage' -Value $NewUsage
        $Places = @(Search-FoursquarePlaces -Client $Client -Latitude $Cluster.latitude -Longitude $Cluster.longitude -RadiusMeters 250 -Limit 5)
        $Business = Select-DriveOSFoursquareMatch -Places $Places -MaximumDistanceMeters 75
        $AddressPlace = @($Places | Where-Object { $_.address -and $null -ne $_.distanceMeters -and [double]$_.distanceMeters -le 250 } | Sort-Object distanceMeters | Select-Object -First 1)[0]
        $Match = if ($Business) { $Business } else { $AddressPlace }
        $Name = if ($Business) { [string]$Business.name } elseif ($AddressPlace) { [string]$AddressPlace.address } else { $null }
        $Entry = [PSCustomObject]@{key=$CacheKey;location='Google Timeline location';latitude=$Cluster.latitude;longitude=$Cluster.longitude;status=if($Name){'matched'}else{'none'};name=$Name;address=if($Match){[string]$Match.address}else{$null};fsqPlaceId=if($Match){[string]$Match.id}else{$null};category=if($Match){[string]$Match.category}else{$null};distanceMeters=if($Match){$Match.distanceMeters}else{$null};resolutionType=if($Business){'business'}elseif($AddressPlace){'address'}else{'unresolved'};resolvedAt=[DateTimeOffset]::UtcNow.ToString('o')}
        $null=$Entries.Add($Entry);$CacheMap[$CacheKey]=$Entry;$Calls++
        if($Name){$Resolved++;if($Business){$Businesses++}else{$Addresses++}}else{$Misses++}

        if (($Calls % 10) -eq 0) {
            Set-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache' -Value ([PSCustomObject]@{version=1;updatedAt=[DateTimeOffset]::UtcNow.ToString('o');entries=@($Entries)})
            Write-Host "Atlas migration: $Calls provider calls completed."
        }
    }

    Set-DriveOSTursoState -Repository $Repository -Key 'foursquare-cache' -Value ([PSCustomObject]@{version=1;updatedAt=[DateTimeOffset]::UtcNow.ToString('o');entries=@($Entries)})
    $Remaining = @($OrderedClusters | Where-Object { -not $CacheMap.ContainsKey((Get-DriveOSPlaceCacheKey -Location 'Google Timeline location' -Latitude $_.latitude -Longitude $_.longitude)) }).Count
    $BillableCalls = [Math]::Max(0,[int]$NewUsage.monthCount-500) - [Math]::Max(0,$StartingMonthCount-500)
    [PSCustomObject]@{uniqueClusters=$Clusters.Count;providerCalls=$Calls;resolved=$Resolved;businesses=$Businesses;addresses=$Addresses;manual=$Manual;misses=$Misses;remaining=$Remaining;freeCallsRemaining=[Math]::Max(0,500-$NewUsage.monthCount);billableCalls=$BillableCalls;estimatedChargeUsd=[Math]::Round($BillableCalls*0.015,2)}
}
finally {
    Remove-Item Env:TURSO_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:TURSO_AUTH_TOKEN -ErrorAction SilentlyContinue
    $ApiKey = $null
}
