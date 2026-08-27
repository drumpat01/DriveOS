param(
    [ValidateSet(7,30)][int[]]$RetentionDays = @(30,7),
    [string]$HouseholdId = 'household_primary',
    [string]$SecretPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Resolve-PreviewSecretPath {
    param([string]$Requested)
    if ($Requested) {
        $Resolved = [IO.Path]::GetFullPath($Requested)
        if (-not (Test-Path -LiteralPath $Resolved -PathType Leaf)) { throw "The requested encrypted secret store does not exist: $Resolved" }
        return $Resolved
    }
    $Candidates = @(
        (Join-Path $Root 'data\driveos-secrets.json'),
        (Join-Path (Split-Path -Parent $Root) 'DriveOS\data\driveos-secrets.json')
    )
    foreach ($Candidate in $Candidates) { if (Test-Path -LiteralPath $Candidate -PathType Leaf) { return [IO.Path]::GetFullPath($Candidate) } }
    throw 'The encrypted desktop secret store was not found. Pass -SecretPath explicitly.'
}

function ConvertTo-PreviewTime {
    param([AllowNull()][object]$Value)
    $Parsed = [DateTimeOffset]::MinValue
    if ([DateTimeOffset]::TryParse("$Value",[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$Parsed)) { return $Parsed.ToUniversalTime() }
    if ([DateTimeOffset]::TryParse("$Value",[Globalization.CultureInfo]::GetCultureInfo('en-US'),[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$Parsed)) { return $Parsed.ToUniversalTime() }
    return $null
}

function New-PreviewPlayKey {
    param([AllowNull()][object]$Track,[AllowNull()][object]$Artist,[long]$EpochSecond)
    return "$Track".Trim().ToLowerInvariant() + [char]0 + "$Artist".Trim().ToLowerInvariant() + [char]0 + "$EpochSecond"
}

Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
$ResolvedSecretPath = Resolve-PreviewSecretPath -Requested $SecretPath
$Secrets = Get-Content -LiteralPath $ResolvedSecretPath -Raw | ConvertFrom-Json
$DatabaseUrl = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop
$AuthToken = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop
$Repository = [pscustomobject]@{ TursoDatabaseUrl = $DatabaseUrl; TursoAuthToken = $AuthToken }

try {
    # Every statement in this tool is a SELECT. The detailed rows are retained only
    # in process so the output contains aggregate counts and no private content.
    $Drives = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT d.id,d.provider,d.started_at_epoch,CASE WHEN EXISTS(SELECT 1 FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jcd.drive_id=d.id AND jc.household_id=d.household_id) THEN 1 ELSE 0 END AS collection_protected FROM drives d WHERE d.household_id=?;" -Args @($HouseholdId))
    $PointRows = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT rs.drive_id,COUNT(*) AS point_count FROM recorder_points rp JOIN recorder_sessions rs ON rs.id=rp.session_id WHERE rs.household_id=? GROUP BY rs.drive_id;" -Args @($HouseholdId))
    $History = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT id,played_at,json_extract(payload_json,'$.source') AS source,json_extract(payload_json,'$.track') AS track,json_extract(payload_json,'$.artist') AS artist FROM listening_history WHERE json_valid(payload_json);")
    $Matched = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT d.id AS drive_id,d.provider,d.started_at_epoch,CASE WHEN EXISTS(SELECT 1 FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jcd.drive_id=d.id AND jc.household_id=d.household_id) THEN 1 ELSE 0 END AS collection_protected,json_extract(song.value,'$.playedAt') AS played_at,json_extract(song.value,'$.track') AS track,json_extract(song.value,'$.artist') AS artist FROM drive_soundtracks ds JOIN drives d ON d.legacy_drive_id=ds.drive_id JOIN json_each(ds.payload_json,'$.songs') song WHERE d.household_id=?;" -Args @($HouseholdId))
    $Content = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT (SELECT COUNT(*) FROM memories WHERE household_id=?) AS memories,(SELECT COUNT(*) FROM journey_collections WHERE household_id=?) AS collections;" -Args @($HouseholdId,$HouseholdId))[0]

    $Previews = foreach ($Days in $RetentionDays) {
        $GeneratedAt = [DateTimeOffset]::UtcNow
        $Cutoff = $GeneratedAt.AddDays(-$Days)
        $CutoffEpoch = $Cutoff.ToUnixTimeSeconds()
        $RemovableDrives = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($Drive in $Drives) {
            if ("$($Drive.provider)" -eq 'google_timeline' -and [long]$Drive.started_at_epoch -lt $CutoffEpoch -and "$($Drive.collection_protected)" -ne '1') {
                [void]$RemovableDrives.Add("$($Drive.id)")
            }
        }

        $TotalPoints = 0L
        $RemovablePoints = 0L
        foreach ($Point in $PointRows) {
            $Count = [long]$Point.point_count
            $TotalPoints += $Count
            if ($RemovableDrives.Contains("$($Point.drive_id)")) { $RemovablePoints += $Count }
        }

        $ProtectedPlayKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($Song in $Matched) {
            $DriveRemoved = "$($Song.provider)" -eq 'google_timeline' -and [long]$Song.started_at_epoch -lt $CutoffEpoch -and "$($Song.collection_protected)" -ne '1'
            if ($DriveRemoved) { continue }
            $PlayedAt = ConvertTo-PreviewTime $Song.played_at
            if ($null -eq $PlayedAt) { continue }
            $Second = $PlayedAt.ToUnixTimeSeconds()
            [void]$ProtectedPlayKeys.Add((New-PreviewPlayKey $Song.track $Song.artist ($Second - 1)))
            [void]$ProtectedPlayKeys.Add((New-PreviewPlayKey $Song.track $Song.artist $Second))
            [void]$ProtectedPlayKeys.Add((New-PreviewPlayKey $Song.track $Song.artist ($Second + 1)))
        }

        $RemovableSongs = 0L
        foreach ($Play in $History) {
            if ("$($Play.source)" -ne 'spotify') { continue }
            $PlayedAt = ConvertTo-PreviewTime $Play.played_at
            if ($null -eq $PlayedAt -or $PlayedAt -ge $Cutoff) { continue }
            if (-not $ProtectedPlayKeys.Contains((New-PreviewPlayKey $Play.track $Play.artist $PlayedAt.ToUnixTimeSeconds()))) { $RemovableSongs++ }
        }

        [pscustomobject]@{
            scope = 'legacy JourneyDeck archive'
            retentionDays = $Days
            generatedAt = $GeneratedAt.ToString('o')
            cutoffAt = $Cutoff.ToString('o')
            journeys = [pscustomobject]@{ total = $Drives.Count; kept = $Drives.Count - $RemovableDrives.Count; removable = $RemovableDrives.Count }
            routePoints = [pscustomobject]@{ total = $TotalPoints; kept = $TotalPoints - $RemovablePoints; removable = $RemovablePoints }
            songs = [pscustomobject]@{ total = $History.Count; kept = $History.Count - $RemovableSongs; removable = $RemovableSongs }
            memories = [pscustomobject]@{ total = [long]$Content.memories; kept = [long]$Content.memories; removable = 0 }
            collections = [pscustomobject]@{ total = [long]$Content.collections; kept = [long]$Content.collections; removable = 0 }
        }
    }
    @($Previews) | ConvertTo-Json -Depth 6
}
finally {
    $DatabaseUrl = $null
    $AuthToken = $null
    $Repository = $null
    $Secrets = $null
    $History = $null
    $Matched = $null
}
