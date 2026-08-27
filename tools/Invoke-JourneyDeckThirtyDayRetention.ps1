param(
    [string]$HouseholdId = 'household_primary',
    [string]$SecretPath = '',
    [int]$ExpectedJourneyRemoval = -1,
    [int]$ExpectedSongRemoval = -1,
    [switch]$Apply,
    [switch]$ConfirmThirtyDayRetention
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$RetentionDays = 30

function Resolve-RetentionSecretPath {
    param([string]$Requested)
    if ($Requested) {
        $Resolved = [IO.Path]::GetFullPath($Requested)
        if (-not (Test-Path -LiteralPath $Resolved -PathType Leaf)) { throw "The requested encrypted secret store does not exist: $Resolved" }
        return $Resolved
    }
    foreach ($Candidate in @((Join-Path $Root 'data\driveos-secrets.json'),(Join-Path (Split-Path -Parent $Root) 'DriveOS\data\driveos-secrets.json'))) {
        if (Test-Path -LiteralPath $Candidate -PathType Leaf) { return [IO.Path]::GetFullPath($Candidate) }
    }
    throw 'The encrypted desktop secret store was not found. Pass -SecretPath explicitly.'
}

function ConvertTo-RetentionTime {
    param([AllowNull()][object]$Value)
    $Parsed = [DateTimeOffset]::MinValue
    if ([DateTimeOffset]::TryParse("$Value",[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$Parsed)) { return $Parsed.ToUniversalTime() }
    if ([DateTimeOffset]::TryParse("$Value",[Globalization.CultureInfo]::GetCultureInfo('en-US'),[Globalization.DateTimeStyles]::AssumeUniversal,[ref]$Parsed)) { return $Parsed.ToUniversalTime() }
    return $null
}

function New-RetentionPlayKey {
    param([AllowNull()][object]$Track,[AllowNull()][object]$Artist,[long]$EpochSecond)
    return "$Track".Trim().ToLowerInvariant() + [char]0 + "$Artist".Trim().ToLowerInvariant() + [char]0 + "$EpochSecond"
}

function Compress-RetentionBytes {
    param([byte[]]$Bytes)
    $Output = [IO.MemoryStream]::new()
    try {
        $Gzip = [IO.Compression.GZipStream]::new($Output,[IO.Compression.CompressionLevel]::Optimal,$true)
        try { $Gzip.Write($Bytes,0,$Bytes.Length) } finally { $Gzip.Dispose() }
        return $Output.ToArray()
    }
    finally { $Output.Dispose() }
}

function Expand-RetentionBytes {
    param([byte[]]$Bytes)
    $Input = [IO.MemoryStream]::new($Bytes)
    $Output = [IO.MemoryStream]::new()
    try {
        $Gzip = [IO.Compression.GZipStream]::new($Input,[IO.Compression.CompressionMode]::Decompress)
        try { $Gzip.CopyTo($Output) } finally { $Gzip.Dispose() }
        return $Output.ToArray()
    }
    finally { $Input.Dispose(); $Output.Dispose() }
}

function Get-RetentionSha256 {
    param([byte[]]$Bytes)
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()
}

Import-Module (Join-Path $Root 'src\Security\DriveOS.SecretProtection.psm1') -Force
Import-Module (Join-Path $Root 'src\Storage\DriveOS.Turso.psm1') -Force
$ResolvedSecretPath = Resolve-RetentionSecretPath -Requested $SecretPath
$Secrets = Get-Content -LiteralPath $ResolvedSecretPath -Raw | ConvertFrom-Json
$DatabaseUrl = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoDatabaseUrl -Mode desktop
$AuthToken = Unprotect-DriveOSSecret -ProtectedText $Secrets.TursoAuthToken -Mode desktop
$Repository = [pscustomobject]@{ TursoDatabaseUrl = $DatabaseUrl; TursoAuthToken = $AuthToken }

try {
    $GeneratedAt = [DateTimeOffset]::UtcNow
    $Cutoff = $GeneratedAt.AddDays(-$RetentionDays)
    $CutoffEpoch = $Cutoff.ToUnixTimeSeconds()
    $Drives = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT d.id,d.legacy_drive_id,d.provider,d.started_at_epoch,CASE WHEN EXISTS(SELECT 1 FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jcd.drive_id=d.id AND jc.household_id=d.household_id) THEN 1 ELSE 0 END AS collection_protected FROM drives d WHERE d.household_id=?;" -Args @($HouseholdId))
    $PointCount = [long](@(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT COUNT(*) AS count FROM recorder_points rp JOIN recorder_sessions rs ON rs.id=rp.session_id WHERE rs.household_id=?;" -Args @($HouseholdId))[0].count)
    $History = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT id,played_at,json_extract(payload_json,'$.source') AS source,json_extract(payload_json,'$.track') AS track,json_extract(payload_json,'$.artist') AS artist FROM listening_history WHERE json_valid(payload_json);")
    $Matched = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT d.id AS drive_id,d.provider,d.started_at_epoch,CASE WHEN EXISTS(SELECT 1 FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jcd.drive_id=d.id AND jc.household_id=d.household_id) THEN 1 ELSE 0 END AS collection_protected,json_extract(song.value,'$.playedAt') AS played_at,json_extract(song.value,'$.track') AS track,json_extract(song.value,'$.artist') AS artist FROM drive_soundtracks ds JOIN drives d ON d.legacy_drive_id=ds.drive_id JOIN json_each(ds.payload_json,'$.songs') song WHERE d.household_id=?;" -Args @($HouseholdId))
    $ContentBefore = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT (SELECT COUNT(*) FROM memories WHERE household_id=?) AS memories,(SELECT COUNT(*) FROM journey_collections WHERE household_id=?) AS collections,(SELECT COUNT(*) FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jc.household_id=?) AS collection_links;" -Args @($HouseholdId,$HouseholdId,$HouseholdId))[0]

    $RemovableDriveIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $RemovableLegacyIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($Drive in $Drives) {
        if ("$($Drive.provider)" -eq 'google_timeline' -and [long]$Drive.started_at_epoch -lt $CutoffEpoch -and "$($Drive.collection_protected)" -ne '1') {
            [void]$RemovableDriveIds.Add("$($Drive.id)")
            [void]$RemovableLegacyIds.Add("$($Drive.legacy_drive_id)")
        }
    }

    $ProtectedPlayKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($Song in $Matched) {
        if ($RemovableDriveIds.Contains("$($Song.drive_id)")) { continue }
        $PlayedAt = ConvertTo-RetentionTime $Song.played_at
        if ($null -eq $PlayedAt) { continue }
        $Second = $PlayedAt.ToUnixTimeSeconds()
        [void]$ProtectedPlayKeys.Add((New-RetentionPlayKey $Song.track $Song.artist ($Second - 1)))
        [void]$ProtectedPlayKeys.Add((New-RetentionPlayKey $Song.track $Song.artist $Second))
        [void]$ProtectedPlayKeys.Add((New-RetentionPlayKey $Song.track $Song.artist ($Second + 1)))
    }

    $RemovableSongIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($Play in $History) {
        if ("$($Play.source)" -ne 'spotify') { continue }
        $PlayedAt = ConvertTo-RetentionTime $Play.played_at
        if ($null -eq $PlayedAt -or $PlayedAt -ge $Cutoff) { continue }
        if (-not $ProtectedPlayKeys.Contains((New-RetentionPlayKey $Play.track $Play.artist $PlayedAt.ToUnixTimeSeconds()))) { [void]$RemovableSongIds.Add("$($Play.id)") }
    }

    $Preview = [pscustomobject]@{
        retentionDays = $RetentionDays
        generatedAt = $GeneratedAt.ToString('o')
        cutoffAt = $Cutoff.ToString('o')
        journeys = [pscustomobject]@{ total = $Drives.Count; kept = $Drives.Count - $RemovableDriveIds.Count; removable = $RemovableDriveIds.Count }
        routePoints = [pscustomobject]@{ total = $PointCount; kept = $PointCount; removable = 0 }
        songs = [pscustomobject]@{ total = $History.Count; kept = $History.Count - $RemovableSongIds.Count; removable = $RemovableSongIds.Count }
        memories = [pscustomobject]@{ total = [long]$ContentBefore.memories; kept = [long]$ContentBefore.memories; removable = 0 }
        collections = [pscustomobject]@{ total = [long]$ContentBefore.collections; kept = [long]$ContentBefore.collections; removable = 0 }
    }
    if (-not $Apply) { $Preview | ConvertTo-Json -Depth 5; return }
    if (-not $ConfirmThirtyDayRetention) { throw 'Apply requires -ConfirmThirtyDayRetention.' }
    if ($ExpectedJourneyRemoval -lt 0 -or $ExpectedSongRemoval -lt 0) { throw 'Apply requires explicit expected removal counts from the immediately preceding preview.' }
    if ($RemovableDriveIds.Count -ne $ExpectedJourneyRemoval -or $RemovableSongIds.Count -ne $ExpectedSongRemoval) {
        throw "Retention preview drifted. Expected $ExpectedJourneyRemoval journeys/$ExpectedSongRemoval songs; found $($RemovableDriveIds.Count)/$($RemovableSongIds.Count). Nothing was changed."
    }

    $DriveIdJson = @($RemovableDriveIds) | ConvertTo-Json -Compress
    $LegacyIdJson = @($RemovableLegacyIds) | ConvertTo-Json -Compress
    $SongIdJson = @($RemovableSongIds) | ConvertTo-Json -Compress
    $DriveBackup = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT * FROM drives WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id;" -Args @($DriveIdJson))
    $SoundtrackBackup = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT * FROM drive_soundtracks WHERE drive_id IN (SELECT value FROM json_each(?)) ORDER BY drive_id;" -Args @($LegacyIdJson))
    $HistoryBackup = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT * FROM listening_history WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id;" -Args @($SongIdJson))
    if ($DriveBackup.Count -ne $RemovableDriveIds.Count -or $HistoryBackup.Count -ne $RemovableSongIds.Count) { throw 'Backup selection did not match the approved preview. Nothing was changed.' }

    $BackupPayload = [ordered]@{
        format = 'journeydeck-retention-recovery-v1'
        householdId = $HouseholdId
        generatedAt = $GeneratedAt.ToString('o')
        cutoffAt = $Cutoff.ToString('o')
        retentionDays = $RetentionDays
        preview = $Preview
        drives = @($DriveBackup)
        driveSoundtracks = @($SoundtrackBackup)
        listeningHistory = @($HistoryBackup)
    }
    $PlainBytes = [Text.Encoding]::UTF8.GetBytes(($BackupPayload | ConvertTo-Json -Depth 12 -Compress))
    $PlainSha256 = Get-RetentionSha256 $PlainBytes
    $CompressedBytes = Compress-RetentionBytes $PlainBytes
    $Entropy = [byte[]]::new(32)
    [Security.Cryptography.RandomNumberGenerator]::Fill($Entropy)
    $EncryptedBytes = [Security.Cryptography.ProtectedData]::Protect($CompressedBytes,$Entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $BackupDirectory = Join-Path $Root 'data\retention-backups'
    [IO.Directory]::CreateDirectory($BackupDirectory) | Out-Null
    $BackupPath = Join-Path $BackupDirectory ("journeydeck-retention-{0}.jdrb" -f $GeneratedAt.ToString('yyyyMMdd-HHmmss'))
    $Wrapper = [ordered]@{ format='journeydeck-retention-encrypted-v1'; createdAt=$GeneratedAt.ToString('o'); sha256=$PlainSha256; entropy=[Convert]::ToBase64String($Entropy); payload=[Convert]::ToBase64String($EncryptedBytes) }
    [IO.File]::WriteAllText($BackupPath,($Wrapper | ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))

    $SavedWrapper = Get-Content -LiteralPath $BackupPath -Raw | ConvertFrom-Json
    $VerifiedCompressed = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($SavedWrapper.payload),[Convert]::FromBase64String($SavedWrapper.entropy),[Security.Cryptography.DataProtectionScope]::CurrentUser)
    $VerifiedBytes = Expand-RetentionBytes $VerifiedCompressed
    if ((Get-RetentionSha256 $VerifiedBytes) -ne $PlainSha256) { throw 'Encrypted recovery package checksum verification failed. Nothing was changed.' }
    $VerifiedPayload = [Text.Encoding]::UTF8.GetString($VerifiedBytes) | ConvertFrom-Json
    if (@($VerifiedPayload.drives).Count -ne $RemovableDriveIds.Count -or @($VerifiedPayload.listeningHistory).Count -ne $RemovableSongIds.Count -or @($VerifiedPayload.driveSoundtracks).Count -ne $SoundtrackBackup.Count) { throw 'Encrypted recovery package row-count verification failed. Nothing was changed.' }

    $Statements = @(
        [pscustomobject]@{ Sql = 'DELETE FROM drive_soundtracks WHERE drive_id IN (SELECT value FROM json_each(?));'; Args = @($LegacyIdJson) },
        [pscustomobject]@{ Sql = 'DELETE FROM listening_history WHERE id IN (SELECT value FROM json_each(?));'; Args = @($SongIdJson) },
        [pscustomobject]@{ Sql = 'DELETE FROM drives WHERE id IN (SELECT value FROM json_each(?));'; Args = @($DriveIdJson) },
        [pscustomobject]@{ Sql = 'UPDATE atlas_snapshot_state SET active_snapshot_id=NULL,dirty=1,rebuild_started_at_utc=NULL,rebuild_completed_at_utc=NULL,last_error=NULL WHERE household_id=?;'; Args = @($HouseholdId) },
        [pscustomobject]@{ Sql = 'DELETE FROM atlas_snapshots WHERE household_id=?;'; Args = @($HouseholdId) },
        [pscustomobject]@{ Sql = 'DELETE FROM atlas_pattern_candidates;'; Args = @() },
        [pscustomobject]@{ Sql = 'DELETE FROM durable_rollups WHERE household_id=?;'; Args = @($HouseholdId) }
    )
    Invoke-DriveOSTursoTransactionalBatch -Repository $Repository -Statements $Statements

    $After = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql "SELECT (SELECT COUNT(*) FROM drives WHERE household_id=?) AS journeys,(SELECT COUNT(*) FROM recorder_points rp JOIN recorder_sessions rs ON rs.id=rp.session_id WHERE rs.household_id=?) AS route_points,(SELECT COUNT(*) FROM listening_history) AS songs,(SELECT COUNT(*) FROM memories WHERE household_id=?) AS memories,(SELECT COUNT(*) FROM journey_collections WHERE household_id=?) AS collections,(SELECT COUNT(*) FROM journey_collection_drives jcd JOIN journey_collections jc ON jc.id=jcd.collection_id WHERE jc.household_id=?) AS collection_links,(SELECT COUNT(*) FROM drives WHERE id IN (SELECT value FROM json_each(?))) AS targeted_journeys,(SELECT COUNT(*) FROM listening_history WHERE id IN (SELECT value FROM json_each(?))) AS targeted_songs,(SELECT COUNT(*) FROM drive_soundtracks WHERE drive_id IN (SELECT value FROM json_each(?))) AS targeted_soundtracks;" -Args @($HouseholdId,$HouseholdId,$HouseholdId,$HouseholdId,$HouseholdId,$DriveIdJson,$SongIdJson,$LegacyIdJson))[0]
    $ExpectedAfterJourneys = $Drives.Count - $RemovableDriveIds.Count
    $ExpectedAfterSongs = $History.Count - $RemovableSongIds.Count
    $Verified = [long]$After.journeys -eq $ExpectedAfterJourneys -and [long]$After.route_points -eq $PointCount -and [long]$After.songs -eq $ExpectedAfterSongs -and [long]$After.memories -eq [long]$ContentBefore.memories -and [long]$After.collections -eq [long]$ContentBefore.collections -and [long]$After.collection_links -eq [long]$ContentBefore.collection_links -and [long]$After.targeted_journeys -eq 0 -and [long]$After.targeted_songs -eq 0 -and [long]$After.targeted_soundtracks -eq 0
    $Integrity = @(Invoke-DriveOSTursoQuery -Repository $Repository -Sql 'PRAGMA integrity_check;')
    if (-not $Verified -or $Integrity.Count -ne 1 -or "$($Integrity[0].integrity_check)" -ne 'ok') { throw "Post-cleanup verification failed. Recovery package: $BackupPath" }

    [pscustomobject]@{
        ok = $true
        retentionDays = $RetentionDays
        cutoffAt = $Cutoff.ToString('o')
        backupPath = $BackupPath
        backupSha256 = $PlainSha256
        removed = [pscustomobject]@{ journeys=$RemovableDriveIds.Count; driveSoundtracks=$SoundtrackBackup.Count; songs=$RemovableSongIds.Count }
        kept = [pscustomobject]@{ journeys=[long]$After.journeys; routePoints=[long]$After.route_points; songs=[long]$After.songs; memories=[long]$After.memories; collections=[long]$After.collections }
        integrityCheck = 'ok'
    } | ConvertTo-Json -Depth 5
}
finally {
    $DatabaseUrl = $null
    $AuthToken = $null
    $Repository = $null
    $Secrets = $null
    $History = $null
    $Matched = $null
}
