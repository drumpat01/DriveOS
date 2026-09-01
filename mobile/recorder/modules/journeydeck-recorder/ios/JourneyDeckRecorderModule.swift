import CoreLocation
import ExpoModulesCore
import SQLite3

private let masterDatabaseApplicationID: Int32 = 0x4a444c31
private let minimumUnifiedSchemaVersion: Int32 = 6
private let driveStartSpeedMetersPerSecond = 6.7
private let driveStartSampleCount = 3
private let driveStartMinimumSpan: TimeInterval = 20
private let driveStartSampleWindow: TimeInterval = 120
private let driveStopSpeedMetersPerSecond = 2.2
private let driveStopDuration: TimeInterval = 5 * 60
private let maximumDetectionAccuracy = 100.0
private let nativeSessionPrefix = "native_recording_"
private let automaticEventCacheKey = "automatic-drive-detection-event-v1"

private enum RecorderDefaults {
  static let enabled = "journeydeck.native-recorder.enabled-v1"
  static let ownerUserID = "journeydeck.native-recorder.owner-v1"
  static let deviceID = "journeydeck.native-recorder.device-v1"
  static let durableState = "journeydeck.native-recorder.state-v1"
  static let lastEvent = "journeydeck.native-recorder.last-event-v1"
  static let lastEventAt = "journeydeck.native-recorder.last-event-at-v1"
  static let lastError = "journeydeck.native-recorder.last-error-v1"
}

private struct DurableDetectionState: Codable {
  var candidateStartedAt: TimeInterval?
  var candidateLastAt: TimeInterval?
  var candidateSamples: Int
  var stoppedSince: TimeInterval?
  var automaticSessionID: String?

  static let empty = DurableDetectionState(
    candidateStartedAt: nil,
    candidateLastAt: nil,
    candidateSamples: 0,
    stoppedSince: nil,
    automaticSessionID: nil
  )
}

private struct ActiveSession {
  let id: String
  let status: String
  let startedAt: Date
}

private enum NativeRecorderError: Error {
  case databaseUnavailable
  case databaseIdentity
  case databaseSchema
  case sqlite(String)
  case notConfigured

  var safeCode: String {
    switch self {
    case .databaseUnavailable: return "database_unavailable"
    case .databaseIdentity: return "database_identity_mismatch"
    case .databaseSchema: return "database_upgrade_required"
    case .sqlite: return "database_write_failed"
    case .notConfigured: return "native_recorder_not_configured"
    }
  }
}

private final class NativeRecorderDatabase {
  private var handle: OpaquePointer?

  init() throws {
    let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("SQLite", isDirectory: true)
    let url = directory.appendingPathComponent("journeydeck-local.db")
    guard FileManager.default.fileExists(atPath: url.path) else { throw NativeRecorderError.databaseUnavailable }
    let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
    guard sqlite3_open_v2(url.path, &handle, flags, nil) == SQLITE_OK else {
      close()
      throw NativeRecorderError.databaseUnavailable
    }
    sqlite3_busy_timeout(handle, 5_000)
    try execute("PRAGMA foreign_keys=ON;")
    let applicationID = try scalarInt("PRAGMA application_id;")
    guard applicationID == masterDatabaseApplicationID else { throw NativeRecorderError.databaseIdentity }
    guard try scalarInt("PRAGMA user_version;") >= minimumUnifiedSchemaVersion else { throw NativeRecorderError.databaseSchema }
  }

  deinit { close() }

  private func close() {
    if let handle { sqlite3_close_v2(handle) }
    handle = nil
  }

  func execute(_ sql: String, bindings: [Any?] = []) throws {
    let statement = try prepare(sql)
    defer { sqlite3_finalize(statement) }
    try bind(bindings, to: statement)
    guard sqlite3_step(statement) == SQLITE_DONE else { throw sqliteError() }
  }

  func scalarInt(_ sql: String, bindings: [Any?] = []) throws -> Int32 {
    let statement = try prepare(sql)
    defer { sqlite3_finalize(statement) }
    try bind(bindings, to: statement)
    guard sqlite3_step(statement) == SQLITE_ROW else { throw sqliteError() }
    return sqlite3_column_int(statement, 0)
  }

  func firstRow(_ sql: String, bindings: [Any?] = []) throws -> [String?]? {
    let statement = try prepare(sql)
    defer { sqlite3_finalize(statement) }
    try bind(bindings, to: statement)
    let result = sqlite3_step(statement)
    if result == SQLITE_DONE { return nil }
    guard result == SQLITE_ROW else { throw sqliteError() }
    return (0..<sqlite3_column_count(statement)).map { index in
      guard sqlite3_column_type(statement, index) != SQLITE_NULL,
            let bytes = sqlite3_column_text(statement, index) else { return nil }
      return String(cString: bytes)
    }
  }

  func transaction(_ work: () throws -> Void) throws {
    try execute("BEGIN IMMEDIATE;")
    do {
      try work()
      try execute("COMMIT;")
    } catch {
      try? execute("ROLLBACK;")
      throw error
    }
  }

  private func prepare(_ sql: String) throws -> OpaquePointer {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
      throw sqliteError()
    }
    return statement
  }

  private func bind(_ values: [Any?], to statement: OpaquePointer) throws {
    for (offset, value) in values.enumerated() {
      let index = Int32(offset + 1)
      let result: Int32
      switch value {
      case nil:
        result = sqlite3_bind_null(statement, index)
      case let value as String:
        result = sqlite3_bind_text(statement, index, (value as NSString).utf8String, -1, SQLITE_TRANSIENT)
      case let value as Int:
        result = sqlite3_bind_int64(statement, index, sqlite3_int64(value))
      case let value as Int32:
        result = sqlite3_bind_int(statement, index, value)
      case let value as Double:
        result = sqlite3_bind_double(statement, index, value)
      case let value as Bool:
        result = sqlite3_bind_int(statement, index, value ? 1 : 0)
      default:
        throw NativeRecorderError.sqlite("unsupported_binding")
      }
      guard result == SQLITE_OK else { throw sqliteError() }
    }
  }

  private func sqliteError() -> NativeRecorderError {
    let message = handle.flatMap { sqlite3_errmsg($0) }.map { String(cString: $0) } ?? "sqlite_error"
    return .sqlite(message)
  }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

final class JourneyDeckNativeRecorder: NSObject, CLLocationManagerDelegate {
  static let shared = JourneyDeckNativeRecorder()

  private let locationManager = CLLocationManager()
  private let workQueue = DispatchQueue(label: "com.journeydeck.native-recorder", qos: .utility)
  private let defaults = UserDefaults.standard
  private var state = DurableDetectionState.empty
  private var candidateLocations: [CLLocation] = []
  private var lastLocation: CLLocation?
  private var significantMonitoring = false
  private var preciseTracking = false

  private override init() {
    super.init()
    state = loadDurableState()
    locationManager.delegate = self
    locationManager.activityType = .automotiveNavigation
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.showsBackgroundLocationIndicator = false
  }

  func bootstrap() {
    guard defaults.bool(forKey: RecorderDefaults.enabled), configuredIdentity() != nil else { return }
    startSignificantMonitoringIfAuthorized()
    workQueue.async { [weak self] in self?.reconcilePersistedSession() }
  }

  func configure(enabled: Bool, ownerUserID: String, deviceID: String) async -> [String: Any] {
    let cleanOwner = ownerUserID.trimmingCharacters(in: .whitespacesAndNewlines)
    let cleanDevice = deviceID.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanOwner.isEmpty, !cleanDevice.isEmpty else {
      setLastError(NativeRecorderError.notConfigured.safeCode)
      return await status()
    }
    defaults.set(enabled, forKey: RecorderDefaults.enabled)
    defaults.set(cleanOwner, forKey: RecorderDefaults.ownerUserID)
    defaults.set(cleanDevice, forKey: RecorderDefaults.deviceID)
    await MainActor.run {
      if enabled { self.startSignificantMonitoringIfAuthorized() }
      else { self.stopSignificantMonitoring() }
    }
    await withCheckedContinuation { continuation in
      workQueue.async {
        self.reconcilePersistedSession()
        continuation.resume()
      }
    }
    return await status()
  }

  func status() async -> [String: Any] {
    let snapshot: (ActiveSession?, String?) = await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard let identity = self.configuredIdentity() else { continuation.resume(returning: (nil, nil)); return }
          let session = try self.activeSession(ownerUserID: identity.owner)
          continuation.resume(returning: (session, nil))
        } catch {
          continuation.resume(returning: (nil, self.safeCode(error)))
        }
      }
    }
    let authorization = await MainActor.run { self.authorizationName(self.locationManager.authorizationStatus) }
    let locationState = await MainActor.run { (self.significantMonitoring, self.preciseTracking) }
    let session = snapshot.0
    let nativeSessionID = session?.id.hasPrefix(nativeSessionPrefix) == true ? session?.id : nil
    let sessionValue: Any = nativeSessionID.map { $0 as Any } ?? NSNull()
    let eventValue: Any = defaults.string(forKey: RecorderDefaults.lastEvent).map { $0 as Any } ?? NSNull()
    let eventAtValue: Any = defaults.string(forKey: RecorderDefaults.lastEventAt).map { $0 as Any } ?? NSNull()
    let errorValue: Any = (snapshot.1 ?? defaults.string(forKey: RecorderDefaults.lastError)).map { $0 as Any } ?? NSNull()
    return [
      "nativeModuleAvailable": true,
      "configured": configuredIdentity() != nil,
      "enabled": defaults.bool(forKey: RecorderDefaults.enabled),
      "significantMonitoring": locationState.0,
      "preciseTracking": locationState.1,
      "recording": session?.status == "recording" && session?.id.hasPrefix(nativeSessionPrefix) == true,
      "paused": session?.status == "paused" && session?.id.hasPrefix(nativeSessionPrefix) == true,
      "sessionId": sessionValue,
      "authorization": authorization,
      "lastEvent": eventValue,
      "lastEventAt": eventAtValue,
      "lastErrorCode": errorValue
    ]
  }

  func pause() async -> [String: Any] {
    await mutateActiveNativeSession(targetStatus: "paused")
    await MainActor.run { self.stopPreciseTracking() }
    return await status()
  }

  func resume() async -> [String: Any] {
    await mutateActiveNativeSession(targetStatus: "recording")
    await MainActor.run { self.startPreciseTrackingIfAuthorized() }
    return await status()
  }

  func finish() async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard let identity = self.configuredIdentity(),
                let session = try self.activeSession(ownerUserID: identity.owner),
                session.id.hasPrefix(nativeSessionPrefix) else { continuation.resume(); return }
          try self.finishSession(session, endedAt: Date())
          self.state = .empty
          self.persistState()
          self.saveEvent("finished", sessionID: session.id)
          self.setLastError(nil)
        } catch { self.setLastError(self.safeCode(error)) }
        continuation.resume()
      }
    }
    await MainActor.run {
      self.stopPreciseTracking()
      if self.defaults.bool(forKey: RecorderDefaults.enabled) { self.startSignificantMonitoringIfAuthorized() }
    }
    return await status()
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    if defaults.bool(forKey: RecorderDefaults.enabled) { startSignificantMonitoringIfAuthorized() }
    if manager.authorizationStatus != .authorizedAlways {
      setLastError("always_location_required")
    } else if defaults.string(forKey: RecorderDefaults.lastError) == "always_location_required" {
      setLastError(nil)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    let ordered = locations.sorted { $0.timestamp < $1.timestamp }
    workQueue.async { [weak self] in self?.process(ordered) }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let code = (error as? CLError)?.code
    if code != .locationUnknown { setLastError(code == .denied ? "location_denied" : "location_service_failed") }
  }

  private func process(_ locations: [CLLocation]) {
    guard let identity = configuredIdentity() else { return }
    do {
      let active = try activeSession(ownerUserID: identity.owner)
      if let active, active.id.hasPrefix(nativeSessionPrefix) {
        state.automaticSessionID = active.id
        if active.status == "recording" {
          try recordAndEvaluate(locations, session: active)
        } else if active.status == "finishing" {
          try finishSession(active, endedAt: locations.last?.timestamp ?? Date())
          state = .empty
          persistState()
          saveEvent("finished", sessionID: active.id)
          DispatchQueue.main.async { self.stopPreciseTracking() }
        }
        return
      }
      if active != nil {
        resetCandidate()
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return
      }
      guard defaults.bool(forKey: RecorderDefaults.enabled) else { return }
      for location in locations {
        if state.automaticSessionID != nil { break }
        try evaluateStart(location, identity: identity)
      }
    } catch {
      setLastError(safeCode(error))
    }
  }

  private func evaluateStart(_ location: CLLocation, identity: (owner: String, device: String)) throws {
    guard validForDetection(location), abs(location.timestamp.timeIntervalSinceNow) <= driveStartSampleWindow else { return }
    let speed = startSpeed(for: location)
    defer { lastLocation = location }
    guard let speed, speed >= driveStartSpeedMetersPerSecond else {
      resetCandidate()
      DispatchQueue.main.async { self.stopPreciseTracking() }
      return
    }
    let timestamp = location.timestamp.timeIntervalSince1970
    let expired = state.candidateStartedAt == nil || state.candidateLastAt == nil
      || timestamp < (state.candidateLastAt ?? timestamp)
      || timestamp - (state.candidateLastAt ?? timestamp) > driveStartSampleWindow
      || timestamp - (state.candidateStartedAt ?? timestamp) > driveStartSampleWindow
    if expired {
      state.candidateStartedAt = timestamp
      state.candidateSamples = 1
      candidateLocations = [location]
    } else {
      state.candidateSamples += 1
      candidateLocations.append(location)
    }
    state.candidateLastAt = timestamp
    persistState()
    DispatchQueue.main.async { self.startPreciseTrackingIfAuthorized() }
    let span = timestamp - (state.candidateStartedAt ?? timestamp)
    guard state.candidateSamples >= driveStartSampleCount, span >= driveStartMinimumSpan else { return }
    do {
      let session = try startSession(identity: identity, locations: candidateLocations)
      state = DurableDetectionState.empty
      state.automaticSessionID = session.id
      candidateLocations = []
      persistState()
      saveEvent("started", sessionID: session.id)
      setLastError(nil)
    } catch {
      saveEvent("start_failed", sessionID: nil)
      resetCandidate()
      DispatchQueue.main.async { self.stopPreciseTracking() }
      throw error
    }
  }

  private func recordAndEvaluate(_ locations: [CLLocation], session: ActiveSession) throws {
    let validLocations = locations.filter { $0.timestamp >= session.startedAt && self.validCoordinate($0) }
    if !validLocations.isEmpty { try insertLocations(validLocations, sessionID: session.id) }
    for location in validLocations where validForDetection(location) {
      let inferred = inferredSpeed(for: location)
      let native = location.speed >= 0 && location.speed <= 150 ? location.speed : nil
      let effective = inferred ?? native ?? 0
      lastLocation = location
      if effective > driveStopSpeedMetersPerSecond {
        state.stoppedSince = nil
      } else {
        let timestamp = location.timestamp.timeIntervalSince1970
        let stoppedSince = state.stoppedSince ?? timestamp
        state.stoppedSince = stoppedSince
        if timestamp - stoppedSince >= driveStopDuration {
          try markFinishing(sessionID: session.id, endedAt: location.timestamp)
          let finishing = ActiveSession(id: session.id, status: "finishing", startedAt: session.startedAt)
          try finishSession(finishing, endedAt: location.timestamp)
          state = .empty
          persistState()
          saveEvent("finished", sessionID: session.id)
          DispatchQueue.main.async {
            self.stopPreciseTracking()
            if self.defaults.bool(forKey: RecorderDefaults.enabled) { self.startSignificantMonitoringIfAuthorized() }
          }
          return
        }
      }
      persistState()
    }
  }

  private func startSession(identity: (owner: String, device: String), locations: [CLLocation]) throws -> ActiveSession {
    let database = try NativeRecorderDatabase()
    let id = nativeSessionPrefix + UUID().uuidString.lowercased()
    let startedAt = locations.first?.timestamp ?? Date()
    let now = Date()
    try database.transaction {
      guard try database.scalarInt("SELECT COUNT(*) FROM local_users WHERE id=?;", bindings: [identity.owner]) == 1 else {
        throw NativeRecorderError.notConfigured
      }
      guard try database.scalarInt("SELECT COUNT(*) FROM recording_sessions WHERE owner_user_id=? AND status<>'completed';", bindings: [identity.owner]) == 0 else {
        throw NativeRecorderError.sqlite("active_session_exists")
      }
      try database.execute(
        "INSERT INTO recording_sessions(id,owner_user_id,device_id,status,started_at,created_at,updated_at) VALUES(?,?,?,'recording',?,?,?);",
        bindings: [id, identity.owner, identity.device, iso(startedAt), iso(now), iso(now)]
      )
      try insertLocations(locations, sessionID: id, database: database)
    }
    return ActiveSession(id: id, status: "recording", startedAt: startedAt)
  }

  private func insertLocations(_ locations: [CLLocation], sessionID: String, database supplied: NativeRecorderDatabase? = nil) throws {
    let database = try supplied ?? NativeRecorderDatabase()
    let work = {
      var sequence = Int(try database.scalarInt("SELECT next_sequence FROM recording_sessions WHERE id=?;", bindings: [sessionID]))
      for location in locations where self.validCoordinate(location) && sequence <= 10_000_000 {
        try database.execute(
          "INSERT OR IGNORE INTO recording_points(session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);",
          bindings: [sessionID, sequence, self.iso(location.timestamp), location.coordinate.latitude, location.coordinate.longitude,
                     self.bounded(location.horizontalAccuracy, 0, 10_000), self.bounded(location.altitude, -1_000, 100_000),
                     self.bounded(location.course, 0, 360), self.bounded(location.speed, 0, 150)]
        )
        sequence += 1
      }
      try database.execute("UPDATE recording_sessions SET next_sequence=?,updated_at=? WHERE id=?;", bindings: [sequence, self.iso(Date()), sessionID])
    }
    if supplied == nil { try database.transaction(work) } else { try work() }
  }

  private func markFinishing(sessionID: String, endedAt: Date) throws {
    let database = try NativeRecorderDatabase()
    try database.execute(
      "UPDATE recording_sessions SET status='finishing',ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=? AND status='recording';",
      bindings: [iso(endedAt), iso(Date()), sessionID]
    )
  }

  private func finishSession(_ session: ActiveSession, endedAt: Date) throws {
    let database = try NativeRecorderDatabase()
    let now = iso(Date())
    let ended = iso(max(endedAt, session.startedAt))
    try database.transaction {
      try database.execute(
        "UPDATE recording_sessions SET status='completed',ended_at=COALESCE(ended_at,?),updated_at=? WHERE id=? AND status<>'completed';",
        bindings: [ended, now, session.id]
      )
      for kind in ["archive_mirror", "apple_music_history", "private_cloud_sync", "remote_completion"] {
        try database.execute(
          """
          INSERT INTO recording_jobs(id,owner_user_id,session_id,kind,status,attempt_count,next_attempt_at,lease_expires_at,last_error_code,created_at,updated_at,completed_at)
          SELECT ? || ':' || ?,owner_user_id,?,?, 'pending',0,?,NULL,NULL,?,?,NULL FROM recording_sessions WHERE id=?
          ON CONFLICT(owner_user_id,session_id,kind) DO UPDATE SET
            status=CASE WHEN recording_jobs.status='completed' THEN 'completed' ELSE 'pending' END,
            next_attempt_at=CASE WHEN recording_jobs.status='completed' THEN recording_jobs.next_attempt_at ELSE excluded.next_attempt_at END,
            lease_expires_at=NULL,last_error_code=CASE WHEN recording_jobs.status='completed' THEN recording_jobs.last_error_code ELSE NULL END,
            updated_at=excluded.updated_at;
          """,
          bindings: [session.id, kind, session.id, kind, now, now, now, session.id]
        )
      }
    }
  }

  private func mutateActiveNativeSession(targetStatus: String) async {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard let identity = self.configuredIdentity(), let session = try self.activeSession(ownerUserID: identity.owner),
                session.id.hasPrefix(nativeSessionPrefix) else { continuation.resume(); return }
          let database = try NativeRecorderDatabase()
          try database.execute("UPDATE recording_sessions SET status=?,updated_at=? WHERE id=? AND status IN ('recording','paused');",
                               bindings: [targetStatus, self.iso(Date()), session.id])
          self.state.automaticSessionID = session.id
          self.persistState()
          self.setLastError(nil)
        } catch { self.setLastError(self.safeCode(error)) }
        continuation.resume()
      }
    }
  }

  private func reconcilePersistedSession() {
    guard let identity = configuredIdentity() else { return }
    do {
      guard let session = try activeSession(ownerUserID: identity.owner) else {
        state = .empty
        persistState()
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return
      }
      guard session.id.hasPrefix(nativeSessionPrefix) else {
        state = .empty
        persistState()
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return
      }
      state.automaticSessionID = session.id
      persistState()
      if session.status == "recording" {
        DispatchQueue.main.async { self.startPreciseTrackingIfAuthorized() }
      } else if session.status == "finishing" {
        try finishSession(session, endedAt: Date())
        state = .empty
        persistState()
        saveEvent("finished", sessionID: session.id)
      }
    } catch { setLastError(safeCode(error)) }
  }

  private func activeSession(ownerUserID: String) throws -> ActiveSession? {
    let database = try NativeRecorderDatabase()
    guard let row = try database.firstRow(
      "SELECT id,status,started_at FROM recording_sessions WHERE owner_user_id=? AND status<>'completed' ORDER BY created_at DESC LIMIT 1;",
      bindings: [ownerUserID]
    ), row.count == 3, let id = row[0], let status = row[1], let started = row[2], let startedAt = parseISO(started) else { return nil }
    return ActiveSession(id: id, status: status, startedAt: startedAt)
  }

  private func saveEvent(_ kind: String, sessionID: String?) {
    let occurredAt = iso(Date())
    defaults.set(kind, forKey: RecorderDefaults.lastEvent)
    defaults.set(occurredAt, forKey: RecorderDefaults.lastEventAt)
    guard let identity = configuredIdentity() else { return }
    do {
      let database = try NativeRecorderDatabase()
      var payload: [String: Any] = ["kind": kind, "occurredAt": occurredAt]
      if let sessionID { payload["sessionId"] = sessionID }
      let data = try JSONSerialization.data(withJSONObject: payload)
      let json = String(data: data, encoding: .utf8) ?? "{}"
      try database.execute(
        "INSERT INTO recording_app_cache(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at;",
        bindings: [automaticEventCacheKey, json, occurredAt]
      )
      _ = identity
    } catch { setLastError(safeCode(error)) }
  }

  private func startSignificantMonitoringIfAuthorized() {
    guard locationManager.authorizationStatus == .authorizedAlways else {
      setLastError("always_location_required")
      return
    }
    guard CLLocationManager.significantLocationChangeMonitoringAvailable() else {
      setLastError("significant_location_unavailable")
      return
    }
    if !significantMonitoring {
      locationManager.startMonitoringSignificantLocationChanges()
      significantMonitoring = true
    }
  }

  private func stopSignificantMonitoring() {
    if significantMonitoring {
      locationManager.stopMonitoringSignificantLocationChanges()
      significantMonitoring = false
    }
    if state.automaticSessionID == nil { stopPreciseTracking() }
  }

  private func startPreciseTrackingIfAuthorized() {
    guard locationManager.authorizationStatus == .authorizedAlways else {
      setLastError("always_location_required")
      return
    }
    guard !preciseTracking else { return }
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    locationManager.distanceFilter = 15
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.startUpdatingLocation()
    preciseTracking = true
  }

  private func stopPreciseTracking() {
    guard preciseTracking else { return }
    locationManager.stopUpdatingLocation()
    locationManager.allowsBackgroundLocationUpdates = false
    preciseTracking = false
  }

  private func resetCandidate() {
    state.candidateStartedAt = nil
    state.candidateLastAt = nil
    state.candidateSamples = 0
    candidateLocations = []
    persistState()
  }

  private func validForDetection(_ location: CLLocation) -> Bool {
    validCoordinate(location) && location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= maximumDetectionAccuracy
  }

  private func validCoordinate(_ location: CLLocation) -> Bool {
    CLLocationCoordinate2DIsValid(location.coordinate)
      && location.coordinate.latitude >= -90 && location.coordinate.latitude <= 90
      && location.coordinate.longitude >= -180 && location.coordinate.longitude <= 180
  }

  private func startSpeed(for location: CLLocation) -> Double? {
    let native = location.speed >= 0 && location.speed <= 150 ? location.speed : nil
    let inferred = inferredSpeed(for: location)
    if let native { return max(native, inferred ?? 0) }
    return inferred
  }

  private func inferredSpeed(for location: CLLocation) -> Double? {
    guard let previous = lastLocation, location.timestamp > previous.timestamp else { return nil }
    let elapsed = location.timestamp.timeIntervalSince(previous.timestamp)
    guard elapsed > 0 else { return nil }
    let uncertainty = max(max(0, location.horizontalAccuracy), max(0, previous.horizontalAccuracy))
    return max(0, location.distance(from: previous) - uncertainty) / elapsed
  }

  private func configuredIdentity() -> (owner: String, device: String)? {
    guard let owner = defaults.string(forKey: RecorderDefaults.ownerUserID), !owner.isEmpty,
          let device = defaults.string(forKey: RecorderDefaults.deviceID), !device.isEmpty else { return nil }
    return (owner, device)
  }

  private func loadDurableState() -> DurableDetectionState {
    guard let data = defaults.data(forKey: RecorderDefaults.durableState),
          let decoded = try? JSONDecoder().decode(DurableDetectionState.self, from: data) else { return .empty }
    return decoded
  }

  private func persistState() {
    if let data = try? JSONEncoder().encode(state) { defaults.set(data, forKey: RecorderDefaults.durableState) }
  }

  private func setLastError(_ code: String?) {
    if let code { defaults.set(code, forKey: RecorderDefaults.lastError) }
    else { defaults.removeObject(forKey: RecorderDefaults.lastError) }
  }

  private func safeCode(_ error: Error) -> String {
    (error as? NativeRecorderError)?.safeCode ?? "native_recorder_failed"
  }

  private func bounded(_ value: Double, _ minimum: Double, _ maximum: Double) -> Double? {
    value.isFinite && value >= minimum && value <= maximum ? value : nil
  }

  private func iso(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  private func parseISO(_ value: String) -> Date? {
    let fractional = ISO8601DateFormatter()
    fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }

  private func authorizationName(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "when_in_use"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "not_determined"
    @unknown default: return "not_determined"
    }
  }
}

public final class JourneyDeckRecorderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JourneyDeckRecorder")

    OnCreate {
      DispatchQueue.main.async { JourneyDeckNativeRecorder.shared.bootstrap() }
    }

    AsyncFunction("configureAsync") { (enabled: Bool, ownerUserID: String, deviceID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.configure(enabled: enabled, ownerUserID: ownerUserID, deviceID: deviceID)
    }

    AsyncFunction("getStatusAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.status()
    }

    AsyncFunction("pauseActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.pause()
    }

    AsyncFunction("resumeActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.resume()
    }

    AsyncFunction("finishActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.finish()
    }
  }
}
