/**
 * Pure SQL builder for the Phase 2 legacy recorder import.
 *
 * This module intentionally has no Expo imports. The runtime and Node's
 * executable preservation test therefore run the exact same copy statements.
 * Only fixed, known table names can affect the generated SQL.
 */
export function legacyRecorderImportSql(availableTables: ReadonlySet<string>): string {
  const statements = [`
    INSERT OR IGNORE INTO recording_sessions(
      id,owner_user_id,device_id,status,started_at,ended_at,next_sequence,
      remote_created,remote_completed,drive_id,created_at,updated_at
    )
    SELECT s.id,s.owner_user_id,s.device_id,s.status,s.started_at,s.ended_at,
      MAX(0,s.next_sequence),s.remote_created,s.remote_completed,s.drive_id,s.created_at,s.updated_at
    FROM legacy_recorder.recording_sessions s
    WHERE s.owner_user_id IS NOT NULL AND trim(s.owner_user_id)<>''
      AND EXISTS(SELECT 1 FROM local_users u WHERE u.id=s.owner_user_id)
      AND s.status IN ('recording','paused','finishing','completed')
      AND julianday(s.started_at) IS NOT NULL
      AND (s.ended_at IS NULL OR julianday(s.ended_at)>=julianday(s.started_at));

    INSERT OR IGNORE INTO recording_points(
      session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,
      altitude_meters,heading_degrees,speed_mps,uploaded
    )
    SELECT p.session_id,p.sequence,p.recorded_at,p.latitude,p.longitude,
      CASE WHEN p.accuracy_meters BETWEEN 0 AND 10000 THEN p.accuracy_meters END,
      CASE WHEN p.altitude_meters BETWEEN -1000 AND 100000 THEN p.altitude_meters END,
      CASE WHEN p.heading_degrees BETWEEN 0 AND 360 THEN p.heading_degrees END,
      CASE WHEN p.speed_mps BETWEEN 0 AND 150 THEN p.speed_mps END,
      CASE WHEN p.uploaded=1 THEN 1 ELSE 0 END
    FROM legacy_recorder.recording_points p
    WHERE EXISTS(SELECT 1 FROM recording_sessions s WHERE s.id=p.session_id)
      AND p.sequence>=0 AND julianday(p.recorded_at) IS NOT NULL
      AND p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180;
  `];

  if (availableTables.has('recording_music_observations')) statements.push(`
    INSERT OR IGNORE INTO recording_music_observations(
      session_id,observation_id,source,played_at,track,artist,album,duration_ms,
      artwork_url,external_url,confidence,uploaded,created_at
    )
    SELECT m.session_id,m.observation_id,m.source,m.played_at,m.track,m.artist,m.album,
      CASE WHEN m.duration_ms BETWEEN 0 AND 3600000 THEN m.duration_ms END,
      m.artwork_url,m.external_url,
      CASE WHEN m.confidence BETWEEN 0 AND 1 THEN m.confidence END,
      CASE WHEN m.uploaded=1 THEN 1 ELSE 0 END,m.created_at
    FROM legacy_recorder.recording_music_observations m
    WHERE EXISTS(SELECT 1 FROM recording_sessions s WHERE s.id=m.session_id)
      AND m.source IN ('apple_music','shazam','lastfm')
      AND trim(m.observation_id)<>'' AND trim(m.track)<>'' AND trim(m.artist)<>''
      AND julianday(m.played_at) IS NOT NULL;
  `);

  if (availableTables.has('recording_lastfm_sync')) statements.push(`
    INSERT OR IGNORE INTO recording_lastfm_sync(
      session_id,username,status,attempt_count,success_count,next_attempt_at,last_attempt_at,updated_at
    )
    SELECT f.session_id,f.username,f.status,MAX(0,f.attempt_count),
      MAX(0,MIN(f.success_count,f.attempt_count)),f.next_attempt_at,f.last_attempt_at,f.updated_at
    FROM legacy_recorder.recording_lastfm_sync f
    WHERE EXISTS(SELECT 1 FROM recording_sessions s WHERE s.id=f.session_id)
      AND length(trim(f.username)) BETWEEN 1 AND 32 AND f.status IN ('pending','synced')
      AND julianday(f.next_attempt_at) IS NOT NULL;
  `);

  if (availableTables.has('recording_app_cache')) statements.push(`
    INSERT OR IGNORE INTO recording_app_cache(key,value_json,updated_at)
    SELECT key,value_json,updated_at FROM legacy_recorder.recording_app_cache
    WHERE length(key) BETWEEN 1 AND 256 AND length(value_json)<=4194304
      AND json_valid(value_json)=1 AND julianday(updated_at) IS NOT NULL;
  `);

  if (availableTables.has('recording_jobs')) statements.push(`
    INSERT OR IGNORE INTO recording_jobs(
      id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,
      lease_expires_at,last_error_code,created_at,updated_at,completed_at
    )
    SELECT j.id,j.owner_user_id,j.session_id,j.kind,
      CASE WHEN j.status='running' THEN 'retry' ELSE j.status END,
      MAX(0,j.attempt_count),j.next_attempt_at,NULL,
      CASE WHEN j.status='running' THEN 'legacy_lease_recovered' ELSE j.last_error_code END,
      j.created_at,j.updated_at,j.completed_at
    FROM legacy_recorder.recording_jobs j
    WHERE EXISTS(SELECT 1 FROM recording_sessions s
      WHERE s.id=j.session_id AND s.owner_user_id=j.owner_user_id AND s.status='completed')
      AND j.kind IN ('archive_mirror','apple_music_history','private_cloud_sync','remote_completion')
      AND j.status IN ('pending','running','retry','completed')
      AND julianday(j.next_attempt_at) IS NOT NULL
      AND julianday(j.created_at) IS NOT NULL AND julianday(j.updated_at) IS NOT NULL
      AND (j.status<>'completed' OR julianday(j.completed_at) IS NOT NULL);
  `);

  return statements.join('\n');
}
