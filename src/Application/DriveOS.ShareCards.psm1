Set-StrictMode -Version 2.0

function Test-DriveOSHomeEndpoint {
    param([string]$FriendlyLocation)
    return -not [string]::IsNullOrWhiteSpace($FriendlyLocation) -and
        $FriendlyLocation.Trim().Equals('Home', [StringComparison]::OrdinalIgnoreCase)
}

function Get-DriveOSShareLocationLabel {
    param(
        [string]$FriendlyLocation,
        [string]$RawLocation,
        [string]$HomeCityLabel = 'Saginaw, TX'
    )

    if (Test-DriveOSHomeEndpoint -FriendlyLocation $FriendlyLocation) { return $HomeCityLabel }
    if ($FriendlyLocation -and $FriendlyLocation -ne $RawLocation) { return $FriendlyLocation.Trim() }

    $Parts = @($RawLocation -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($Parts.Count -ge 3) {
        $City = $Parts[1]
        $Region = ($Parts[2] -replace '\d', '').Trim()
        $Region = switch -Regex ($Region) {
            '^Texas$' { 'TX'; break }
            '^Michigan$' { 'MI'; break }
            '^Oklahoma$' { 'OK'; break }
            default { $Region }
        }
        if ($Region.Length -gt 2) { $Region = $Region.Substring(0, [Math]::Min(2, $Region.Length)).ToUpperInvariant() }
        return "$City, $Region".TrimEnd(' ', ',')
    }
    if ($Parts.Count -ge 2) { return $Parts[1] }
    return 'Drive location'
}

function Get-DriveOSShareTitle {
    param([Parameter(Mandatory=$true)][string]$StartedAt)
    $Started = [DateTimeOffset]::Parse($StartedAt).ToLocalTime()
    $Moment = if ($Started.Hour -lt 5) { 'Late Night' }
        elseif ($Started.Hour -lt 12) { 'Morning' }
        elseif ($Started.Hour -lt 17) { 'Afternoon' }
        elseif ($Started.Hour -lt 21) { 'Evening' }
        else { 'Night' }
    return "$($Started.ToString('dddd')) $Moment Drive"
}

function ConvertTo-DriveOSNormalizedRoute {
    param([object[]]$Points = @())
    $Valid = @($Points | Where-Object {
        $null -ne $_.latitude -and $null -ne $_.longitude -and
        [double]$_.latitude -ge -90 -and [double]$_.latitude -le 90 -and
        [double]$_.longitude -ge -180 -and [double]$_.longitude -le 180
    })
    if ($Valid.Count -eq 0) { return @() }

    if ($Valid.Count -gt 120) {
        $Step = [Math]::Ceiling($Valid.Count / 120.0)
        $Sampled = @()
        for ($Index = 0; $Index -lt $Valid.Count; $Index += $Step) { $Sampled += $Valid[$Index] }
        if ($Sampled[-1] -ne $Valid[-1]) { $Sampled += $Valid[-1] }
        $Valid = $Sampled
    }

    $MinLat = [double]($Valid | Measure-Object latitude -Minimum).Minimum
    $MaxLat = [double]($Valid | Measure-Object latitude -Maximum).Maximum
    $MinLon = [double]($Valid | Measure-Object longitude -Minimum).Minimum
    $MaxLon = [double]($Valid | Measure-Object longitude -Maximum).Maximum
    $LatSpan = [Math]::Max(0.0001, $MaxLat - $MinLat)
    $LonSpan = [Math]::Max(0.0001, $MaxLon - $MinLon)

    return @($Valid | ForEach-Object {
        [PSCustomObject]@{
            x = [Math]::Round(0.08 + ((([double]$_.longitude - $MinLon) / $LonSpan) * 0.84), 4)
            y = [Math]::Round(0.92 - ((([double]$_.latitude - $MinLat) / $LatSpan) * 0.84), 4)
        }
    })
}

function Select-DriveOSShareGeoRoute {
    param(
        [object[]]$Points = @(),
        [ValidateRange(2,200)][int]$Limit = 120
    )
    $Valid = @($Points | Where-Object {
        $null -ne $_.latitude -and $null -ne $_.longitude -and
        [double]$_.latitude -ge -90 -and [double]$_.latitude -le 90 -and
        [double]$_.longitude -ge -180 -and [double]$_.longitude -le 180
    })
    if ($Valid.Count -le $Limit) {
        return @($Valid | ForEach-Object { [PSCustomObject]@{
            latitude=[Math]::Round([double]$_.latitude,6)
            longitude=[Math]::Round([double]$_.longitude,6)
        }})
    }
    $Step = [Math]::Ceiling($Valid.Count / [double]$Limit)
    $Sampled = @()
    for ($Index = 0; $Index -lt $Valid.Count; $Index += $Step) { $Sampled += $Valid[$Index] }
    if ($Sampled[-1] -ne $Valid[-1]) { $Sampled += $Valid[-1] }
    return @($Sampled | ForEach-Object { [PSCustomObject]@{
        latitude=[Math]::Round([double]$_.latitude,6)
        longitude=[Math]::Round([double]$_.longitude,6)
    }})
}

function New-DriveOSPrivateCityGeoRoute {
    param(
        [double]$StartLatitude,
        [double]$StartLongitude,
        [double]$EndLatitude,
        [double]$EndLongitude
    )

    $Points = @()
    $LatDelta = $EndLatitude - $StartLatitude
    $LonDelta = $EndLongitude - $StartLongitude
    for ($Index = 0; $Index -le 12; $Index++) {
        $T = $Index / 12.0
        $Curve = [Math]::Sin($T * [Math]::PI) * 0.08
        $Points += [PSCustomObject]@{
            latitude = $StartLatitude + ($LatDelta * $T) + ($LonDelta * $Curve)
            longitude = $StartLongitude + ($LonDelta * $T) - ($LatDelta * $Curve)
        }
    }
    return @(Select-DriveOSShareGeoRoute -Points $Points)
}

function New-DriveOSShareCardModel {
    param(
        [Parameter(Mandatory=$true)]$Drive,
        $MapData = $null,
        [double]$HomeCityLatitude = 32.8601,
        [double]$HomeCityLongitude = -97.3639,
        [string]$HomeCityLabel = 'Saginaw, TX'
    )

    $StartIsHome = Test-DriveOSHomeEndpoint -FriendlyLocation $Drive.startingLocation
    $EndIsHome = Test-DriveOSHomeEndpoint -FriendlyLocation $Drive.endingLocation
    $HomeProtected = $StartIsHome -or $EndIsHome
    $StartLabel = Get-DriveOSShareLocationLabel -FriendlyLocation $Drive.startingLocation -RawLocation $Drive.rawStartingLocation -HomeCityLabel $HomeCityLabel
    $EndLabel = Get-DriveOSShareLocationLabel -FriendlyLocation $Drive.endingLocation -RawLocation $Drive.rawEndingLocation -HomeCityLabel $HomeCityLabel

    $StartLat = if ($StartIsHome) { $HomeCityLatitude } else { [double]$Drive.startingLatitude }
    $StartLon = if ($StartIsHome) { $HomeCityLongitude } else { [double]$Drive.startingLongitude }
    $EndLat = if ($EndIsHome) { $HomeCityLatitude } else { [double]$Drive.endingLatitude }
    $EndLon = if ($EndIsHome) { $HomeCityLongitude } else { [double]$Drive.endingLongitude }

    $GeoRoute = @()
    $RouteMode = 'recorded-simplified'
    if ($HomeProtected) {
        $GeoRoute = @(New-DriveOSPrivateCityGeoRoute -StartLatitude $StartLat -StartLongitude $StartLon -EndLatitude $EndLat -EndLongitude $EndLon)
        $RouteMode = 'city-private'
    }
    elseif ($MapData -and @($MapData.routePoints).Count -gt 1) {
        $GeoRoute = @(Select-DriveOSShareGeoRoute -Points @($MapData.routePoints))
    }
    else {
        $GeoRoute = @(New-DriveOSPrivateCityGeoRoute -StartLatitude $StartLat -StartLongitude $StartLon -EndLatitude $EndLat -EndLongitude $EndLon)
        $RouteMode = 'endpoint-simplified'
    }

    $Songs = @($Drive.soundtrack)
    $ShareSongMarkers = @()
    if ($GeoRoute.Count -gt 1) {
        if ($HomeProtected) {
            $DriveStart = $null
            $DriveDurationSeconds = [Math]::Max(1, [double]$Drive.durationMinutes * 60.0)
            try { $DriveStart = [DateTimeOffset]::Parse([string]$Drive.startedAt) } catch {}
            for ($SongIndex = 0; $SongIndex -lt $Songs.Count; $SongIndex++) {
                $Progress = if ($Songs.Count -gt 1) { $SongIndex / [double]($Songs.Count - 1) } else { 0.5 }
                if ($DriveStart -and $Songs[$SongIndex].playedAt) {
                    try {
                        $SongTime = [DateTimeOffset]::Parse([string]$Songs[$SongIndex].playedAt)
                        $Progress = ($SongTime - $DriveStart).TotalSeconds / $DriveDurationSeconds
                    } catch {}
                }
                $Progress = [Math]::Max(0, [Math]::Min(1, $Progress))
                $Position = $Progress * ($GeoRoute.Count - 1)
                $Lower = [Math]::Floor($Position)
                $Upper = [Math]::Min($GeoRoute.Count - 1, $Lower + 1)
                $Fraction = $Position - $Lower
                $ShareSongMarkers += [PSCustomObject]@{
                    index = $SongIndex + 1
                    latitude = [Math]::Round(([double]$GeoRoute[$Lower].latitude * (1 - $Fraction)) + ([double]$GeoRoute[$Upper].latitude * $Fraction), 6)
                    longitude = [Math]::Round(([double]$GeoRoute[$Lower].longitude * (1 - $Fraction)) + ([double]$GeoRoute[$Upper].longitude * $Fraction), 6)
                    locationMode = 'synthetic-progress'
                }
            }
        }
        elseif ($MapData) {
            $ShareSongMarkers = @(@($MapData.songMarkers) | Where-Object {
                $null -ne $_.latitude -and $null -ne $_.longitude -and
                [double]$_.latitude -ge -90 -and [double]$_.latitude -le 90 -and
                [double]$_.longitude -ge -180 -and [double]$_.longitude -le 180
            } | ForEach-Object {
                [PSCustomObject]@{
                    index = [int]$_.index
                    latitude = [Math]::Round([double]$_.latitude, 6)
                    longitude = [Math]::Round([double]$_.longitude, 6)
                    locationMode = 'recorded'
                }
            })
        }
    }
    $Featured = @($Songs | Where-Object { $_.track } | Select-Object -First 1)[0]
    $TopArtist = @($Songs | Where-Object { $_.artist } | Group-Object artist |
        Sort-Object @{Expression='Count';Descending=$true}, Name | Select-Object -First 1)[0]
    $TopArtistName = if ($TopArtist) { [string]$TopArtist.Name } else { $null }
    $Moment = $null
    if ($Featured) {
        $NearStart = $false
        try {
            $SongTime = [DateTimeOffset]::Parse([string]$Featured.playedAt)
            $DriveTime = [DateTimeOffset]::Parse([string]$Drive.startedAt)
            $NearStart = [Math]::Abs(($SongTime - $DriveTime).TotalMinutes) -le 7
        }
        catch {}
        $Moment = if ($NearStart) { "started near $StartLabel" }
        else { 'joined the drive along the way' }
    }

    return [PSCustomObject]@{
        schemaVersion = 1
        driveId = [string]$Drive.id
        title = Get-DriveOSShareTitle -StartedAt ([string]$Drive.startedAt)
        dateLabel = [string]$Drive.dateLabel
        routeLabel = "$StartLabel to $EndLabel"
        startLabel = $StartLabel
        endLabel = $EndLabel
        route = [PSCustomObject]@{
            mode=$RouteMode
            points=@(ConvertTo-DriveOSNormalizedRoute -Points $GeoRoute)
            mapPoints=@($GeoRoute)
            songMarkers=@($ShareSongMarkers)
        }
        stats = [PSCustomObject]@{
            miles = $Drive.miles
            durationMinutes = $Drive.durationMinutes
            efficiencyWhMi = $Drive.efficiencyWhMi
            songs = $Songs.Count
            topArtist = $TopArtistName
        }
        featured = if ($Featured) { [PSCustomObject]@{
            track = [string]$Featured.track
            artist = [string]$Featured.artist
            album = [string]$Featured.album
            trackId = [string]$Featured.trackId
            momentContext = $Moment
        }} else { $null }
        privacy = [PSCustomObject]@{
            homeProtected = $HomeProtected
            homeReplacement = if ($HomeProtected) { $HomeCityLabel } else { $null }
            homeCoordinatesIncluded = $false
            routeCoordinates = if ($HomeProtected) { 'city-level-synthetic' } else { 'recorded-simplified' }
            songCoordinates = if ($HomeProtected) { 'time-projected-synthetic' } else { 'recorded' }
            rawAddressesIncluded = $false
            note = if ($HomeProtected) {
                "Home was replaced with $HomeCityLabel. The real Home route geometry is not included."
            } else { 'Street addresses are not included. The recorded route is shown on the map.' }
        }
    }
}

Export-ModuleMember -Function Test-DriveOSHomeEndpoint,Get-DriveOSShareLocationLabel,Get-DriveOSShareTitle,ConvertTo-DriveOSNormalizedRoute,Select-DriveOSShareGeoRoute,New-DriveOSPrivateCityGeoRoute,New-DriveOSShareCardModel
