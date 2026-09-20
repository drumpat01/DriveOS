import CoreLocation
import ExpoModulesCore
import MapKit
import SQLite3
import UIKit

private final class JourneyDeckDisplayLayoutObserver: ExpoView {
  let onDisplayLayoutChange = EventDispatcher()
  private var lastSignature = ""

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    backgroundColor = .clear
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    publishLayoutIfChanged()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    publishLayoutIfChanged()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    publishLayoutIfChanged()
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    publishLayoutIfChanged()
  }

  private func sizeClassName(_ sizeClass: UIUserInterfaceSizeClass) -> String {
    switch sizeClass {
    case .compact: return "compact"
    case .regular: return "regular"
    default: return "unspecified"
    }
  }

  private func rectPayload(_ rect: CGRect) -> [String: Double] {
    ["x": rect.minX, "y": rect.minY, "width": rect.width, "height": rect.height]
  }

  private func publishLayoutIfChanged() {
    var divisionRegions: [[String: Double]] = []
    var occlusionRegions: [[String: Double]] = []

#if JOURNEYDECK_DUO_RESERVED_REGIONS
    if #available(iOS 27.1, *) {
      divisionRegions = reservedRegions(kind: .division).map { rectPayload($0.frame) }
      occlusionRegions = reservedRegions(kind: .occlusion).map { rectPayload($0.frame) }
    }
#endif

    let horizontal = sizeClassName(traitCollection.horizontalSizeClass)
    let vertical = sizeClassName(traitCollection.verticalSizeClass)
    let signature = "\(bounds.width):\(bounds.height):\(horizontal):\(vertical):\(divisionRegions):\(occlusionRegions)"
    guard signature != lastSignature else { return }
    lastSignature = signature
    onDisplayLayoutChange([
      "width": bounds.width,
      "height": bounds.height,
      "horizontalSizeClass": horizontal,
      "verticalSizeClass": vertical,
      "divisionRegions": divisionRegions,
      "occlusionRegions": occlusionRegions,
    ])
  }
}

private let nativeInboxApplicationID: Int32 = 0x4a444e31
private let nativeInboxSchemaVersion: Int32 = 4
private let driveStartSpeedMetersPerSecond = 6.7
private let driveStartSampleCount = 3
private let driveStartMinimumSpan: TimeInterval = 20
private let driveStartSampleWindow: TimeInterval = 120
private let driveStartConfirmationGrace: TimeInterval = 90
private let driveStartPreRollWindow: TimeInterval = 4 * 60
private let driveStartPreRollLimit = 32
private let driveStopSpeedMetersPerSecond = 2.2
private let driveStopDuration: TimeInterval = 5 * 60
private let maximumDetectionAccuracy = 100.0
private let nativeSessionPrefix = "native_recording_"
private let manualSessionPrefix = "native_recording_manual_"

private enum RecorderDefaults {
  static let enabled = "journeydeck.native-recorder.enabled-v1"
  static let ownerUserID = "journeydeck.native-recorder.owner-v1"
  static let deviceID = "journeydeck.native-recorder.device-v1"
  static let durableState = "journeydeck.native-recorder.state-v1"
  static let lastEvent = "journeydeck.native-recorder.last-event-v1"
  static let lastEventAt = "journeydeck.native-recorder.last-event-at-v1"
  static let lastError = "journeydeck.native-recorder.last-error-v1"
  static let manualOwner = "journeydeck.native-recorder.manual-owner-v1"
  static let legacyManualActive = "journeydeck.native-recorder.legacy-manual-v1"
  static let controlToken = "journeydeck.native-recorder.control-token-v1"
}

private struct DurableDetectionState: Codable {
  var candidateStartedAt: TimeInterval?
  var candidateLastAt: TimeInterval?
  var candidateSamples: Int
  var stoppedSince: TimeInterval?
  var automaticSessionID: String?
  var lastCommandSequence: Int?
  var manualInactivity: ManualJourneyInactivity?

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

private struct RecorderStatusSnapshot {
  let session: ActiveSession?
  let error: String?
  let owner: String?
  let device: String?
  let enabled: Bool
  let streamID: String
  let sequence: Int
  let lastEvent: String?
  let lastEventAt: String?
  let lastError: String?
  let controlToken: String
  let manualReady: Bool
  let legacyManualActive: Bool
}

enum NativeRecorderError: Error {
  case databaseUnavailable
  case databaseIdentity
  case databaseSchema
  case sqlite(String)
  case notConfigured
  case commandConflict

  var safeCode: String {
    switch self {
    case .commandConflict: return "command_id_conflict"
    case .databaseUnavailable: return "database_unavailable"
    case .databaseIdentity: return "database_identity_mismatch"
    case .databaseSchema: return "database_upgrade_required"
    case .sqlite: return "database_write_failed"
    case .notConfigured: return "native_recorder_not_configured"
    }
  }
}

final class NativeRecorderDatabase {
  private var handle: OpaquePointer?

  init(directoryOverride: URL? = nil) throws {
    let directory = directoryOverride ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("SQLite", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent("journeydeck-native-inbox.db")
    let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
    guard sqlite3_open_v2(url.path, &handle, flags, nil) == SQLITE_OK else {
      close()
      throw NativeRecorderError.databaseUnavailable
    }
    sqlite3_busy_timeout(handle, 5_000)
    guard let journalRow = try firstRow("PRAGMA journal_mode=DELETE;"),
          let journalMode = journalRow.first ?? nil,
          journalMode.lowercased() == "delete" else {
      throw NativeRecorderError.databaseUnavailable
    }
    try execute("PRAGMA synchronous=FULL;")
    try execute("PRAGMA foreign_keys=ON;")
    let applicationID = try scalarInt("PRAGMA application_id;")
    guard applicationID == 0 || applicationID == nativeInboxApplicationID else { throw NativeRecorderError.databaseIdentity }
    let schemaVersion = try scalarInt("PRAGMA user_version;")
    guard schemaVersion <= nativeInboxSchemaVersion else { throw NativeRecorderError.databaseSchema }
    if schemaVersion == 0 {
      try transaction {
        try execute("""
          CREATE TABLE IF NOT EXISTS native_recording_sessions(
            id TEXT PRIMARY KEY NOT NULL,
            owner_user_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('recording','paused','finishing','completed')),
            started_at TEXT NOT NULL,
            ended_at TEXT,
            next_sequence INTEGER NOT NULL DEFAULT 0 CHECK(next_sequence>=0),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            CHECK(ended_at IS NULL OR ended_at>=started_at),
            CHECK(status<>'completed' OR ended_at IS NOT NULL)
          );
        """)
        try execute("CREATE INDEX IF NOT EXISTS ix_native_sessions_owner ON native_recording_sessions(owner_user_id,status,created_at);")
        try execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_native_sessions_active_owner ON native_recording_sessions(owner_user_id) WHERE status<>'completed';")
        try execute("""
          CREATE TABLE IF NOT EXISTS native_recording_points(
            session_id TEXT NOT NULL REFERENCES native_recording_sessions(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL CHECK(sequence>=0),
            recorded_at TEXT NOT NULL,
            latitude REAL NOT NULL CHECK(latitude>=-90 AND latitude<=90),
            longitude REAL NOT NULL CHECK(longitude>=-180 AND longitude<=180),
            accuracy_meters REAL CHECK(accuracy_meters IS NULL OR (accuracy_meters>=0 AND accuracy_meters<=10000)),
            altitude_meters REAL CHECK(altitude_meters IS NULL OR (altitude_meters>=-1000 AND altitude_meters<=100000)),
            heading_degrees REAL CHECK(heading_degrees IS NULL OR (heading_degrees>=0 AND heading_degrees<=360)),
            speed_mps REAL CHECK(speed_mps IS NULL OR (speed_mps>=0 AND speed_mps<=150)),
            PRIMARY KEY(session_id,sequence)
          );
        """)
        try execute("PRAGMA application_id=1245990449;")
        try execute("PRAGMA user_version=1;")
      }
    }
    if schemaVersion < 2 {
      try transaction {
        try execute(RecorderCommandJournal.schema)
        try execute("CREATE INDEX IF NOT EXISTS ix_native_commands_pending ON native_recorder_commands(owner_user_id,state,sequence);")
        try execute("PRAGMA user_version=2;")
      }
    }
    if schemaVersion < 3 {
      try transaction {
        try execute(RecorderStateMachine.checkpointSchema)
        try execute("PRAGMA user_version=3;")
      }
    }
    if schemaVersion < 4 {
      try transaction {
        try execute("""
          CREATE TABLE native_journey_markers(
            id TEXT PRIMARY KEY NOT NULL,
            session_id TEXT NOT NULL REFERENCES native_recording_sessions(id) ON DELETE CASCADE,
            captured_at TEXT NOT NULL, location_at TEXT NOT NULL,
            latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
            longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
            accuracy_meters REAL NOT NULL CHECK(accuracy_meters BETWEEN 0 AND 100)
          );
        """)
        try execute("PRAGMA user_version=4;")
      }
    }
    #if os(iOS)
    try? FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: url.path
    )
    #endif
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

  func rows(_ sql: String, bindings: [Any?] = []) throws -> [[Any]] {
    let statement = try prepare(sql)
    defer { sqlite3_finalize(statement) }
    try bind(bindings, to: statement)
    var output: [[Any]] = []
    while true {
      let result = sqlite3_step(statement)
      if result == SQLITE_DONE { return output }
      guard result == SQLITE_ROW else { throw sqliteError() }
      output.append((0..<sqlite3_column_count(statement)).map { index in
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER: return Int(sqlite3_column_int64(statement, index))
        case SQLITE_FLOAT: return sqlite3_column_double(statement, index)
        case SQLITE_TEXT:
          guard let bytes = sqlite3_column_text(statement, index) else { return NSNull() }
          return String(cString: bytes)
        default: return NSNull()
        }
      })
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
  private let workQueueKey = DispatchSpecificKey<UInt8>()
  private let defaults = UserDefaults.standard
  private var state = DurableDetectionState.empty
  private var candidateLocations: [CLLocation] = []
  private var preRollLocations: [CLLocation] = []
  private var lastLocation: CLLocation?
  private var significantMonitoring = false
  private var preciseTracking = false
  private var locationStateGeneration = 0
  private var lastAuthorizationStatus: CLAuthorizationStatus = .notDetermined
  private var confirmationBurstTimer: DispatchWorkItem?
  private var transitionObserver: (token: UUID, callback: (RecorderTransitionEvent) -> Void)?
  private var eventStreamID = UUID().uuidString.lowercased()
  private var eventSequence = 0

  private override init() {
    super.init()
    workQueue.setSpecific(key: workQueueKey, value: 1)
    locationManager.delegate = self
    lastAuthorizationStatus = locationManager.authorizationStatus
    locationManager.activityType = .automotiveNavigation
    locationManager.pausesLocationUpdatesAutomatically = false
    locationManager.showsBackgroundLocationIndicator = false
  }

  func setTransitionObserver(_ observer: @escaping (RecorderTransitionEvent) -> Void) -> UUID {
    let token = UUID()
    workQueue.async { self.transitionObserver = (token, observer) }
    return token
  }

  func removeTransitionObserver(token: UUID) {
    workQueue.async {
      guard self.transitionObserver?.token == token else { return }
      self.transitionObserver = nil
    }
  }

  func bootstrap() {
    guard configuredIdentity() != nil else { return }
    if defaults.bool(forKey: RecorderDefaults.enabled) { startSignificantMonitoringIfAuthorized() }
    workQueue.async { [weak self] in self?.reconcilePersistedSession() }
  }

  // Profile readiness and the legacy-session fence are applied on the same
  // serial queue as Watch commands and native session creation.
  func configureManual(ready: Bool, ownerUserID: String, legacyActive: Bool) async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        guard self.configuredIdentity()?.owner == ownerUserID else { continuation.resume(); return }
        let wasReady = self.defaults.string(forKey: RecorderDefaults.manualOwner) == ownerUserID
        if ready && self.configuredIdentity()?.owner == ownerUserID {
          self.defaults.set(ownerUserID, forKey: RecorderDefaults.manualOwner)
          if !wasReady || self.defaults.string(forKey: RecorderDefaults.controlToken) == nil {
            self.defaults.set(UUID().uuidString, forKey: RecorderDefaults.controlToken)
          }
        } else {
          self.defaults.removeObject(forKey: RecorderDefaults.manualOwner)
        }
        self.defaults.set(legacyActive, forKey: RecorderDefaults.legacyManualActive)
        continuation.resume()
      }
    }
    let result = await status()
    await JourneyDeckWatchBridge.shared.publish()
    return result
  }

  func startManual(requestID: String, expectedToken: String? = nil) async -> [String: Any] {
    let snapshot = await status()
    return await executeCommand(operationID: requestID, action: "start", sessionID: "",
      expectedToken: expectedToken ?? (snapshot["controlToken"] as? String ?? ""),
      expiresAt: Date().timeIntervalSince1970 + 30)
  }

  func executeCommand(operationID: String, action: String, sessionID: String, expectedToken: String, expiresAt: Double) async -> [String: Any] {
    let authorized = await MainActor.run {
      CLLocationManager.locationServicesEnabled() && self.locationManager.authorizationStatus == .authorizedAlways
    }
    let outcome: [String: Any] = await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard expiresAt.isFinite, Date().timeIntervalSince1970 <= expiresAt,
                expiresAt - Date().timeIntervalSince1970 <= 60, UUID(uuidString: operationID) != nil, ["start", "pause", "resume", "finish"].contains(action),
                let identity = self.configuredIdentity(), !expectedToken.isEmpty,
                expectedToken == self.defaults.string(forKey: RecorderDefaults.controlToken) else {
            continuation.resume(returning: ["state": "rejected", "errorCode": "refresh_required"]); return
          }
          let database = try NativeRecorderDatabase()
          let journal = RecorderCommandJournal(database)
          let id = operationID.lowercased()
          let target = action == "start" ? manualSessionPrefix + id : sessionID
          guard target.hasPrefix(nativeSessionPrefix) else {
            continuation.resume(returning: ["state": "rejected", "errorCode": "invalid_request"]); return
          }
          // Drain older intents before accepting another action on this queue.
          try journal.recover(owner: identity.owner) { self.saveCommandEvent(action: $0, sessionID: $1) }
          if action == "start" || action == "resume" {
            guard authorized else {
              continuation.resume(returning: ["state": "rejected", "errorCode": "always_location_required"]); return
            }
          }
          if action == "start" && (self.defaults.string(forKey: RecorderDefaults.manualOwner) != identity.owner
              || self.defaults.bool(forKey: RecorderDefaults.legacyManualActive)) {
            continuation.resume(returning: ["state": "rejected", "errorCode": "open_iphone_required"]); return
          }
          let previousReceipt = try journal.outcome(operationID: id, owner: identity.owner)
          try journal.submit(operationID: id, owner: identity.owner, device: identity.device,
                             action: action, sessionID: target, issuedAt: self.iso(Date()))
          try self.stopTrackingForPendingCommand(database, owner: identity.owner)
          try journal.recover(owner: identity.owner, permittedOperationID: id) { self.saveCommandEvent(action: $0, sessionID: $1) }
          let receipt = try journal.outcome(operationID: id, owner: identity.owner)
          if receipt["state"] as? String == "applied", previousReceipt["state"] as? String != "applied" {
            self.state.manualInactivity = nil
             self.lastLocation = nil
             self.setLastError(nil)
          }
          self.reconcilePersistedSession()
          continuation.resume(returning: receipt)
        } catch {
          self.setLastError(self.safeCode(error))
          continuation.resume(returning: ["state": "pending", "errorCode": self.safeCode(error)])
        }
      }
    }
    var result = await status()
    result["command"] = outcome
    if let error = outcome["errorCode"] as? String { result["lastErrorCode"] = error }
    await JourneyDeckWatchBridge.shared.publish()
    return result
  }

  func commandOutcome(operationID: String) async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard let identity = self.configuredIdentity() else { throw NativeRecorderError.notConfigured }
          let database = try NativeRecorderDatabase()
          let journal = RecorderCommandJournal(database)
          try self.stopTrackingForPendingCommand(database, owner: identity.owner)
          try journal.recover(owner: identity.owner) { self.saveCommandEvent(action: $0, sessionID: $1) }
          self.reconcilePersistedSession()
          continuation.resume(returning: try journal.outcome(operationID: operationID.lowercased(), owner: identity.owner))
        } catch { continuation.resume(returning: ["state": "pending", "errorCode": self.safeCode(error)]) }
      }
    }
  }

  func configure(enabled: Bool, ownerUserID: String, deviceID: String) async -> [String: Any] {
    let cleanOwner = ownerUserID.trimmingCharacters(in: .whitespacesAndNewlines)
    let cleanDevice = deviceID.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanOwner.isEmpty, !cleanDevice.isEmpty else {
      setLastError(NativeRecorderError.notConfigured.safeCode)
      return await status()
    }
    let configured: Bool = await withCheckedContinuation { continuation in
      workQueue.async {
        let previous = self.configuredIdentity()
        let changed = previous?.owner != cleanOwner || previous?.device != cleanDevice
        do {
          if changed {
            DispatchQueue.main.async { self.stopPreciseTracking() }
            let database = try NativeRecorderDatabase()
            // Also fence the incoming owner's old session: returning to a
            // profile must not revive a recording left behind by an interrupted
            // profile change or by cleared configuration defaults.
            var owners = [(owner: cleanOwner, device: cleanDevice)]
            if let previous, previous.owner != cleanOwner { owners.insert(previous, at: 0) }
            for identity in owners {
              if let row = try database.firstRow(
                "SELECT id,status FROM native_recording_sessions WHERE owner_user_id=? AND status<>'completed';",
                bindings: [identity.owner]), let id = row[0] {
                let action: RecorderTransitionAction = row[1] == "finishing" ? .finish : .pause
                let result = try RecorderStateMachine(database).apply(.init(action: action, source: .recovery,
                  owner: identity.owner, device: identity.device, sessionID: id, occurredAt: self.iso(Date()),
                  startedAt: nil, checkpoint: nil, operationID: nil, permitRestartStart: false))
                guard result.applied else { throw NativeRecorderError.sqlite(result.errorCode ?? "profile_fence_failed") }
                if identity.owner == previous?.owner { self.saveCommandEvent(action: action.rawValue, sessionID: id) }
              }
            }
            self.defaults.removeObject(forKey: RecorderDefaults.manualOwner)
            self.defaults.set(UUID().uuidString, forKey: RecorderDefaults.controlToken)
            self.defaults.removeObject(forKey: RecorderDefaults.lastEvent)
            self.defaults.removeObject(forKey: RecorderDefaults.lastEventAt)
            self.defaults.removeObject(forKey: RecorderDefaults.lastError)
            self.state = .empty
            self.candidateLocations = []
            self.preRollLocations = []
            self.lastLocation = nil
            self.eventStreamID = UUID().uuidString.lowercased()
            self.eventSequence = 0
          }
          self.defaults.set(enabled, forKey: RecorderDefaults.enabled)
          self.defaults.set(cleanOwner, forKey: RecorderDefaults.ownerUserID)
          self.defaults.set(cleanDevice, forKey: RecorderDefaults.deviceID)
          continuation.resume(returning: true)
        } catch {
          // A failed database fence must not enable the requested profile, or
          // allow bootstrap/status to rearm the previous profile after relaunch.
          self.defaults.set(false, forKey: RecorderDefaults.enabled)
          self.defaults.removeObject(forKey: RecorderDefaults.ownerUserID)
          self.defaults.removeObject(forKey: RecorderDefaults.deviceID)
          self.defaults.removeObject(forKey: RecorderDefaults.manualOwner)
          self.defaults.removeObject(forKey: RecorderDefaults.controlToken)
          self.state = .empty
          self.candidateLocations = []
          self.preRollLocations = []
          self.lastLocation = nil
          self.eventStreamID = UUID().uuidString.lowercased()
          self.eventSequence = 0
          self.setLastError(self.safeCode(error))
          DispatchQueue.main.async { self.stopSignificantMonitoring(); self.stopPreciseTracking() }
          continuation.resume(returning: false)
        }
      }
    }
    guard configured else { return await status() }
    await MainActor.run {
      if self.defaults.bool(forKey: RecorderDefaults.enabled) { self.startSignificantMonitoringIfAuthorized() }
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
    await status(attempt: 0)
  }

  private func status(attempt: Int) async -> [String: Any] {
    let snapshot: RecorderStatusSnapshot = await withCheckedContinuation { continuation in
      workQueue.async {
        let identity = self.configuredIdentity()
        let enabled = self.defaults.bool(forKey: RecorderDefaults.enabled)
        let controlToken = self.defaults.string(forKey: RecorderDefaults.controlToken) ?? ""
        let legacyManualActive = self.defaults.bool(forKey: RecorderDefaults.legacyManualActive)
        let manualReady = identity != nil && identity?.owner == self.defaults.string(forKey: RecorderDefaults.manualOwner)
          && !legacyManualActive
        do {
          guard let identity else {
            continuation.resume(returning: RecorderStatusSnapshot(session: nil, error: nil, owner: nil, device: nil,
              enabled: enabled, streamID: self.eventStreamID, sequence: self.eventSequence,
              lastEvent: self.defaults.string(forKey: RecorderDefaults.lastEvent),
              lastEventAt: self.defaults.string(forKey: RecorderDefaults.lastEventAt),
              lastError: self.defaults.string(forKey: RecorderDefaults.lastError), controlToken: controlToken,
              manualReady: manualReady, legacyManualActive: legacyManualActive)); return
          }
          var session = try self.activeSession(ownerUserID: identity.owner)
          var reconciliationError: String?
          // Polling recovers transport for a committed active journey. Do not
          // reconcile the idle path here: it owns automatic-detection bursts.
          if session != nil {
            reconciliationError = self.reconcilePersistedSession()
            session = try self.activeSession(ownerUserID: identity.owner)
          }
          continuation.resume(returning: RecorderStatusSnapshot(session: session, error: reconciliationError, owner: identity.owner,
            device: identity.device, enabled: enabled, streamID: self.eventStreamID, sequence: self.eventSequence,
            lastEvent: self.defaults.string(forKey: RecorderDefaults.lastEvent),
            lastEventAt: self.defaults.string(forKey: RecorderDefaults.lastEventAt),
            lastError: self.defaults.string(forKey: RecorderDefaults.lastError), controlToken: controlToken,
            manualReady: manualReady, legacyManualActive: legacyManualActive))
        } catch {
          continuation.resume(returning: RecorderStatusSnapshot(session: nil, error: self.safeCode(error),
            owner: identity?.owner, device: identity?.device, enabled: enabled, streamID: self.eventStreamID,
            sequence: self.eventSequence, lastEvent: self.defaults.string(forKey: RecorderDefaults.lastEvent),
            lastEventAt: self.defaults.string(forKey: RecorderDefaults.lastEventAt),
            lastError: self.defaults.string(forKey: RecorderDefaults.lastError),
            controlToken: controlToken, manualReady: manualReady, legacyManualActive: legacyManualActive))
        }
      }
    }
    let locationState = await MainActor.run {
      (self.authorizationName(self.locationManager.authorizationStatus), self.significantMonitoring,
       self.preciseTracking, self.locationStateGeneration)
    }
    let stillCurrent = await withCheckedContinuation { continuation in
      workQueue.async {
        let identity = self.configuredIdentity()
        continuation.resume(returning: identity?.owner == snapshot.owner && identity?.device == snapshot.device
          && self.eventStreamID == snapshot.streamID && self.eventSequence == snapshot.sequence
          && self.defaults.bool(forKey: RecorderDefaults.enabled) == snapshot.enabled
          && (self.defaults.string(forKey: RecorderDefaults.controlToken) ?? "") == snapshot.controlToken
          && self.defaults.bool(forKey: RecorderDefaults.legacyManualActive) == snapshot.legacyManualActive
          && (identity != nil && identity?.owner == self.defaults.string(forKey: RecorderDefaults.manualOwner)
            && !snapshot.legacyManualActive) == snapshot.manualReady)
      }
    }
    let locationStillCurrent = await MainActor.run { self.locationStateGeneration == locationState.3 }
    if (!stillCurrent || !locationStillCurrent) && attempt == 0 { return await status(attempt: 1) }
    let coherent = stillCurrent && locationStillCurrent
    let session = coherent ? snapshot.session : nil
    let nativeSessionID = session?.id.hasPrefix(nativeSessionPrefix) == true ? session?.id : nil
    let sessionValue: Any = nativeSessionID.map { $0 as Any } ?? NSNull()
    let eventValue: Any = snapshot.lastEvent.map { $0 as Any } ?? NSNull()
    let eventAtValue: Any = snapshot.lastEventAt.map { $0 as Any } ?? NSNull()
    let errorValue: Any = (snapshot.error ?? snapshot.lastError).map { $0 as Any } ?? NSNull()
    return [
      "nativeModuleAvailable": true,
      "statusReliable": snapshot.error == nil && coherent,
      "configured": snapshot.owner != nil && coherent,
      "enabled": snapshot.enabled,
      "significantMonitoring": locationState.1,
      "preciseTracking": locationState.2,
      "commandJournalVersion": 1,
      "eventStreamId": snapshot.streamID,
      "eventSequence": snapshot.sequence,
      "recording": session?.status == "recording" && session?.id.hasPrefix(nativeSessionPrefix) == true,
      "paused": session?.status == "paused" && session?.id.hasPrefix(nativeSessionPrefix) == true,
      "sessionId": sessionValue,
      "authorization": locationState.0,
      "lastEvent": eventValue,
      "lastEventAt": eventAtValue,
      "lastErrorCode": errorValue,
      "controlToken": snapshot.controlToken,
      "manualReady": snapshot.manualReady && coherent,
      "legacyManualActive": snapshot.legacyManualActive
    ]
  }

  private func legacyCommand(action: String, expectedSessionID: String?) async -> [String: Any] {
    let snapshot = await status()
    guard let sessionID = expectedSessionID ?? (snapshot["sessionId"] as? String) else { return snapshot }
    return await executeCommand(operationID: UUID().uuidString, action: action, sessionID: sessionID,
      expectedToken: snapshot["controlToken"] as? String ?? "", expiresAt: Date().timeIntervalSince1970 + 30)
  }

  func pause(expectedSessionID: String? = nil) async -> [String: Any] {
    await legacyCommand(action: "pause", expectedSessionID: expectedSessionID)
  }
  func resume(expectedSessionID: String? = nil) async -> [String: Any] {
    await legacyCommand(action: "resume", expectedSessionID: expectedSessionID)
  }
  func finish(expectedSessionID: String? = nil) async -> [String: Any] {
    await legacyCommand(action: "finish", expectedSessionID: expectedSessionID)
  }

  // This queue also serializes recorder commands, profile switches and GPS writes.
  // Capture uses a recent durable fix; it never invents a location or starts a trip.
  func createMarker(operationID: String, sessionID: String, expectedToken: String) async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard Bundle.main.bundleIdentifier == "com.journeydeck.recorder.v3",
                UUID(uuidString: operationID) != nil,
                let identity = self.configuredIdentity(),
                self.defaults.string(forKey: RecorderDefaults.manualOwner) == identity.owner,
                !expectedToken.isEmpty,
                expectedToken == self.defaults.string(forKey: RecorderDefaults.controlToken) else {
            continuation.resume(returning: ["errorCode": "refresh_required"]); return
          }
          let database = try NativeRecorderDatabase()
          let id = "marker_" + operationID.lowercased()
          if let existing = try database.firstRow("SELECT m.id FROM native_journey_markers m JOIN native_recording_sessions s ON s.id=m.session_id WHERE m.id=? AND s.id=? AND s.owner_user_id=?;", bindings: [id, sessionID, identity.owner]), existing[0] != nil {
            continuation.resume(returning: ["id": id, "errorCode": NSNull()]); return
          }
          guard let session = try self.activeSession(ownerUserID: identity.owner), session.id == sessionID, session.status == "recording" else {
            continuation.resume(returning: ["errorCode": "no_active_journey"]); return
          }
          let capturedAt = Date()
          guard let point = try database.firstRow("SELECT recorded_at,latitude,longitude,accuracy_meters FROM native_recording_points WHERE session_id=? ORDER BY sequence DESC LIMIT 1;", bindings: [session.id]),
                let at = point[0], let date = self.parseISO(at),
                let latText = point[1], let lat = Double(latText),
                let lngText = point[2], let lng = Double(lngText),
                let accuracyText = point[3], let accuracy = Double(accuracyText),
                accuracy >= 0, accuracy <= 100, date >= session.startedAt,
                capturedAt.timeIntervalSince(date) >= -5, capturedAt.timeIntervalSince(date) <= 30 else {
            continuation.resume(returning: ["errorCode": "marker_location_unavailable"]); return
          }
          try database.execute("INSERT INTO native_journey_markers(id,session_id,captured_at,location_at,latitude,longitude,accuracy_meters) VALUES(?,?,?,?,?,?,?);", bindings: [id, session.id, self.iso(capturedAt), at, lat, lng, accuracy])
          continuation.resume(returning: ["id": id, "errorCode": NSNull()])
        } catch {
          continuation.resume(returning: ["errorCode": self.safeCode(error)])
        }
      }
    }
  }

  func exportInbox(afterSequences: [String: Int], preferredSessionID: String? = nil) async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          guard let identity = self.configuredIdentity() else {
            continuation.resume(returning: ["sessions": [], "errorCode": NSNull()])
            return
          }
          let database = try NativeRecorderDatabase()
          let rows = try database.rows(
            """
            SELECT id,owner_user_id,device_id,status,started_at,ended_at,next_sequence,created_at,updated_at
            FROM native_recording_sessions WHERE owner_user_id=?
            ORDER BY CASE WHEN id=? THEN 0 WHEN status<>'completed' THEN 1 ELSE 2 END,created_at LIMIT 20;
            """,
            bindings: [identity.owner, preferredSessionID]
          )
          let sessions: [[String: Any]] = try rows.compactMap { row in
            guard row.count == 9,
                  let id = row[0] as? String,
                  let owner = row[1] as? String,
                  let device = row[2] as? String,
                  let status = row[3] as? String,
                  let startedAt = row[4] as? String,
                  let nextSequence = row[6] as? Int,
                  let createdAt = row[7] as? String,
                  let updatedAt = row[8] as? String else { return nil }
            let pointRows = try database.rows(
              """
              SELECT sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps
              FROM native_recording_points WHERE session_id=? AND sequence>=? ORDER BY sequence LIMIT 100000;
              """,
              bindings: [id, max(0, afterSequences[id] ?? 0)]
            )
            let points: [[String: Any]] = pointRows.compactMap { point in
              guard point.count == 8,
                    let sequence = point[0] as? Int,
                    let recordedAt = point[1] as? String,
                    let latitude = point[2] as? Double,
                    let longitude = point[3] as? Double else { return nil }
              return [
                "sequence": sequence, "recordedAt": recordedAt,
                "latitude": latitude, "longitude": longitude,
                "accuracyMeters": point[4], "altitudeMeters": point[5],
                "headingDegrees": point[6], "speedMps": point[7]
              ]
            }
            let markers = try database.rows("SELECT id,captured_at,location_at,latitude,longitude,accuracy_meters FROM native_journey_markers WHERE session_id=? ORDER BY captured_at,id;", bindings: [id]).map { marker -> [String: Any] in
              ["id": marker[0], "capturedAt": marker[1], "locationAt": marker[2], "latitude": marker[3], "longitude": marker[4], "accuracyMeters": marker[5]]
            }
            return [
              "markers": markers,
              "id": id, "ownerUserId": owner, "deviceId": device, "status": status,
              "startedAt": startedAt, "endedAt": row[5], "nextSequence": nextSequence,
              "createdAt": createdAt, "updatedAt": updatedAt, "points": points
            ]
          }
          continuation.resume(returning: ["sessions": sessions, "errorCode": NSNull()])
        } catch {
          continuation.resume(returning: ["sessions": [], "errorCode": self.safeCode(error)])
        }
      }
    }
  }

  func acknowledgeCompletedSessions(_ sessionIDs: [String]) async -> [String: Any] {
    await withCheckedContinuation { continuation in
      workQueue.async {
        do {
          let database = try NativeRecorderDatabase()
          let allowed = Array(Set(sessionIDs.filter { $0.hasPrefix(nativeSessionPrefix) })).prefix(20)
          try database.transaction {
            for id in allowed {
              try database.execute(
                "DELETE FROM native_recording_sessions WHERE id=? AND status='completed';",
                bindings: [id]
              )
            }
          }
          continuation.resume(returning: ["acknowledged": allowed.count, "errorCode": NSNull()])
        } catch {
          continuation.resume(returning: ["acknowledged": 0, "errorCode": self.safeCode(error)])
        }
      }
    }
  }

  func nearbyPointsOfInterest(latitude: Double, longitude: Double, radiusMeters: Double) async -> [[String: Any]] {
    guard latitude.isFinite, longitude.isFinite,
          latitude >= -90, latitude <= 90, longitude >= -180, longitude <= 180 else { return [] }
    let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    let radius = max(50, min(500, radiusMeters))
    let request = MKLocalPointsOfInterestRequest(center: center, radius: radius)
    request.pointOfInterestFilter = .includingAll
    do {
      let response = try await MKLocalSearch(request: request).start()
      let origin = CLLocation(latitude: latitude, longitude: longitude)
      return response.mapItems.compactMap { item -> [String: Any]? in
        guard let name = item.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else { return nil }
        let coordinate = item.placemark.coordinate
        guard CLLocationCoordinate2DIsValid(coordinate) else { return nil }
        let distance = origin.distance(from: CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude))
        guard distance <= radius else { return nil }
        return [
          "name": name,
          "latitude": coordinate.latitude,
          "longitude": coordinate.longitude,
          "distanceMeters": distance,
          "category": item.pointOfInterestCategory.map { $0.rawValue as Any } ?? NSNull()
        ]
      }
      .sorted { ($0["distanceMeters"] as? Double ?? .greatestFiniteMagnitude) < ($1["distanceMeters"] as? Double ?? .greatestFiniteMagnitude) }
      .prefix(8).map { $0 }
    } catch {
      return []
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    if manager.authorizationStatus != lastAuthorizationStatus {
      lastAuthorizationStatus = manager.authorizationStatus
      locationStateGeneration += 1
    }
    if defaults.bool(forKey: RecorderDefaults.enabled) { startSignificantMonitoringIfAuthorized() }
    if manager.authorizationStatus != .authorizedAlways {
      stopPreciseTracking()
      setLastError("always_location_required")
    } else {
      setLastError(nil)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    let ordered = locations.sorted { $0.timestamp < $1.timestamp }
    if defaults.bool(forKey: RecorderDefaults.enabled) && !preciseTracking {
      startConfirmationBurstIfAuthorized()
    }
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
        try restoreCheckpoint(database: NativeRecorderDatabase(), identity: identity, session: active)
        if active.status == "recording" {
          try recordAndEvaluate(locations, session: active)
        } else if active.status == "finishing" {
          let finalLocation = locations.last
          do {
            try finishSession(active, endedAt: finalLocation?.timestamp ?? Date()) { database in
              if let finalLocation, self.validCoordinate(finalLocation) {
                try self.insertLocations([finalLocation], sessionID: active.id, database: database)
              }
            }
          }
          catch {
            DispatchQueue.main.async { self.stopPreciseTracking() }
            throw error
          }
          state = .empty
          saveEvent("finished", sessionID: active.id)
          DispatchQueue.main.async { self.stopPreciseTracking() }
        }
        return
      }
      if active != nil {
        preRollLocations = []
        DispatchQueue.main.async {
          self.cancelConfirmationBurst()
          self.stopPreciseTracking()
        }
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
    let previousCandidateLocations = candidateLocations
    let previousPreRollLocations = preRollLocations
    appendPreRoll(location)
    let speed = startSpeed(for: location)
    guard let speed else { lastLocation = location; return }
    guard speed >= driveStartSpeedMetersPerSecond else {
      do { try resetCandidate(owner: identity.owner); lastLocation = location }
      catch {
        candidateLocations = previousCandidateLocations
        preRollLocations = previousPreRollLocations
        throw error
      }
      return
    }
    let timestamp = location.timestamp.timeIntervalSince1970
    let expired = state.candidateStartedAt == nil || state.candidateLastAt == nil
      || timestamp < (state.candidateLastAt ?? timestamp)
      || timestamp - (state.candidateLastAt ?? timestamp) > driveStartSampleWindow
      || timestamp - (state.candidateStartedAt ?? timestamp) > driveStartSampleWindow
    var nextState = state
    if expired {
      nextState.candidateStartedAt = timestamp
      nextState.candidateSamples = 1
      candidateLocations = [location]
    } else {
      nextState.candidateSamples += 1
      candidateLocations.append(location)
    }
    nextState.candidateLastAt = timestamp
    do { try commitState(nextState, owner: identity.owner, sessionID: nil) }
    catch {
      candidateLocations = previousCandidateLocations
      preRollLocations = previousPreRollLocations
      throw error
    }
    lastLocation = location
    DispatchQueue.main.async { self.startPreciseTrackingIfAuthorized() }
    let span = timestamp - (nextState.candidateStartedAt ?? timestamp)
    guard nextState.candidateSamples >= driveStartSampleCount, span >= driveStartMinimumSpan else { return }
    do {
      let departureLocations = preRollLocations.isEmpty ? candidateLocations : preRollLocations
      let session = try startSession(identity: identity, locations: departureLocations)
      var committed = DurableDetectionState.empty
      committed.automaticSessionID = session.id
      committed.lastCommandSequence = state.lastCommandSequence
      state = committed
      candidateLocations = []
      preRollLocations = []
      DispatchQueue.main.async { self.cancelConfirmationBurst() }
      saveEvent("started", sessionID: session.id)
      setLastError(nil)
    } catch {
      saveEvent("start_failed", sessionID: nil)
      try? resetCandidate(owner: identity.owner)
      preRollLocations = []
      DispatchQueue.main.async {
        self.cancelConfirmationBurst()
        self.stopPreciseTracking()
      }
      throw error
    }
  }

  private func recordAndEvaluate(_ locations: [CLLocation], session: ActiveSession) throws {
    if session.id.hasPrefix(manualSessionPrefix) {
      try recordManualAndEvaluate(locations, session: session)
      return
    }
    let validLocations = locations.filter { $0.timestamp >= session.startedAt && self.validCoordinate($0) }
    for location in validLocations {
      let previousLastLocation = lastLocation
      if !validForDetection(location) {
        guard let owner = configuredIdentity()?.owner else { throw NativeRecorderError.notConfigured }
        try commitState(state, owner: owner, sessionID: session.id) { database in
          try self.insertLocations([location], sessionID: session.id, database: database)
        }
        continue
      }
      let inferred = inferredSpeed(for: location)
      let native = location.speed >= 0 && location.speed <= 150 ? location.speed : nil
      let effective = inferred ?? native ?? 0
      lastLocation = location
      var nextState = state
      if effective > driveStopSpeedMetersPerSecond {
        nextState.stoppedSince = nil
      } else {
        let timestamp = location.timestamp.timeIntervalSince1970
        let stoppedSince = nextState.stoppedSince ?? timestamp
        nextState.stoppedSince = stoppedSince
        if timestamp - stoppedSince >= driveStopDuration {
          do {
            try finishSession(session, endedAt: location.timestamp) { database in
              try self.insertLocations([location], sessionID: session.id, database: database)
            }
          } catch {
            lastLocation = previousLastLocation
            DispatchQueue.main.async { self.stopPreciseTracking() }
            throw error
          }
          state = .empty
          saveEvent("finished", sessionID: session.id)
          DispatchQueue.main.async {
            self.stopPreciseTracking()
            if self.defaults.bool(forKey: RecorderDefaults.enabled) { self.startSignificantMonitoringIfAuthorized() }
          }
          return
        }
      }
      guard let owner = configuredIdentity()?.owner else { throw NativeRecorderError.notConfigured }
      do {
        try commitState(nextState, owner: owner, sessionID: session.id) { database in
          try self.insertLocations([location], sessionID: session.id, database: database)
        }
      } catch { lastLocation = previousLastLocation; throw error }
    }
  }

  private func recordManualAndEvaluate(_ locations: [CLLocation], session: ActiveSession) throws {
    var policy = state.manualInactivity ?? ManualJourneyInactivity()
    let now = Date().timeIntervalSince1970
    for location in locations where location.timestamp >= session.startedAt && location.timestamp.timeIntervalSince1970 <= now {
      let stop = policy.observe(.init(timestamp: location.timestamp.timeIntervalSince1970,
        latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
        accuracy: location.horizontalAccuracy, speed: location.speed), now: now)
      var nextState = state
      nextState.manualInactivity = policy
      if stop || now - session.startedAt.timeIntervalSince1970 >= ManualJourneyInactivity.maximumDuration {
        do {
          try finishSession(session, endedAt: location.timestamp) { database in
            if self.validCoordinate(location) { try self.insertLocations([location], sessionID: session.id, database: database) }
          }
        }
        catch { DispatchQueue.main.async { self.stopPreciseTracking() }; throw error }
        state = .empty
        saveEvent("manual_auto_finished", sessionID: session.id)
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return
      }
      guard let owner = configuredIdentity()?.owner else { throw NativeRecorderError.notConfigured }
      try commitState(nextState, owner: owner, sessionID: session.id) {
        if self.validCoordinate(location) { try self.insertLocations([location], sessionID: session.id, database: $0) }
      }
    }
  }

  private func startSession(identity: (owner: String, device: String), locations: [CLLocation], manualID: String? = nil) throws -> ActiveSession {
    let database = try NativeRecorderDatabase()
    let id = manualID ?? (nativeSessionPrefix + UUID().uuidString.lowercased())
    let startedAt = locations.first?.timestamp ?? Date()
    let now = Date()
    var checkpoint = DurableDetectionState.empty
    checkpoint.automaticSessionID = id
    checkpoint.lastCommandSequence = state.lastCommandSequence
    let json = try JSONEncoder().encode(checkpoint)
    let result = try RecorderStateMachine(database).apply(.init(action: .start, source: .automatic,
      owner: identity.owner, device: identity.device, sessionID: id, occurredAt: iso(now), startedAt: iso(startedAt),
      checkpoint: String(data: json, encoding: .utf8), operationID: nil, permitRestartStart: true)) {
        try self.insertLocations(locations, sessionID: id, database: database)
      }
    guard result.applied else { throw NativeRecorderError.sqlite(result.errorCode ?? "transition_rejected") }
    return ActiveSession(id: id, status: "recording", startedAt: startedAt)
  }

  private func insertLocations(_ locations: [CLLocation], sessionID: String, database: NativeRecorderDatabase) throws {
      var sequence = Int(try database.scalarInt("SELECT next_sequence FROM native_recording_sessions WHERE id=?;", bindings: [sessionID]))
      for location in locations where self.validCoordinate(location) && sequence <= 10_000_000 {
        try database.execute(
          "INSERT OR IGNORE INTO native_recording_points(session_id,sequence,recorded_at,latitude,longitude,accuracy_meters,altitude_meters,heading_degrees,speed_mps) VALUES(?,?,?,?,?,?,?,?,?);",
          bindings: [sessionID, sequence, self.iso(location.timestamp), location.coordinate.latitude, location.coordinate.longitude,
                     self.bounded(location.horizontalAccuracy, 0, 10_000), self.bounded(location.altitude, -1_000, 100_000),
                     self.bounded(location.course, 0, 360), self.bounded(location.speed, 0, 150)]
        )
        sequence += 1
      }
      try database.execute("UPDATE native_recording_sessions SET next_sequence=?,updated_at=? WHERE id=?;", bindings: [sequence, self.iso(Date()), sessionID])
  }

  private func finishSession(_ session: ActiveSession, endedAt: Date,
                             relatedWrites: ((NativeRecorderDatabase) throws -> Void)? = nil) throws {
    let database = try NativeRecorderDatabase()
    let ended = iso(max(endedAt, session.startedAt))
    guard let identity = configuredIdentity() else { throw NativeRecorderError.notConfigured }
    let source: RecorderTransitionSource = session.id.hasPrefix(manualSessionPrefix) ? .inactivity : .automatic
    let result = try RecorderStateMachine(database).apply(.init(action: .finish, source: source,
      owner: identity.owner, device: identity.device, sessionID: session.id, occurredAt: ended, startedAt: nil,
      checkpoint: nil, operationID: nil, permitRestartStart: false)) {
        try relatedWrites?(database)
      }
    guard result.applied else { throw NativeRecorderError.sqlite(result.errorCode ?? "transition_rejected") }
  }

  @discardableResult
  private func reconcilePersistedSession() -> String? {
    guard let identity = configuredIdentity() else { return nil }
    do {
      guard let session = try activeSession(ownerUserID: identity.owner) else {
        let database = try NativeRecorderDatabase()
        if let json = try RecorderStateMachine(database).loadIdleCheckpoint(owner: identity.owner),
           let data = json.data(using: .utf8), let decoded = try? JSONDecoder().decode(DurableDetectionState.self, from: data),
           decoded.automaticSessionID == nil { state = decoded }
        else { state = .empty }
        defaults.removeObject(forKey: RecorderDefaults.durableState)
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return nil
      }
      guard session.id.hasPrefix(nativeSessionPrefix) else {
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return nil
      }
      // Finishing is terminal work. The state machine rejects new movement
      // checkpoints for it, so complete it before attempting restoration.
      if session.status == "finishing" {
        try finishSession(session, endedAt: Date())
        state = .empty
        saveEvent("finished", sessionID: session.id)
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return nil
      }
      try restoreCheckpoint(database: NativeRecorderDatabase(), identity: identity, session: session)
      if state.automaticSessionID != session.id {
        var nextState = state
        nextState.manualInactivity = nil
        nextState.automaticSessionID = session.id
        try commitState(nextState, owner: identity.owner, sessionID: session.id)
      }
      if session.id.hasPrefix(manualSessionPrefix),
         Date().timeIntervalSince(session.startedAt) >= ManualJourneyInactivity.maximumDuration
          || (session.status == "recording" && state.manualInactivity?.shouldFinish(now: Date().timeIntervalSince1970) == true) {
        try finishSession(session, endedAt: Date())
        state = .empty
        saveEvent("manual_auto_finished", sessionID: session.id)
        DispatchQueue.main.async { self.stopPreciseTracking() }
        return nil
      }
      if session.status == "recording" {
        DispatchQueue.main.async { self.startPreciseTrackingIfAuthorized() }
      } else if session.status == "paused" {
        DispatchQueue.main.async { self.stopPreciseTracking() }
      }
      return nil
    } catch {
      let code = safeCode(error)
      setLastError(code)
      DispatchQueue.main.async { self.stopPreciseTracking() }
      return code
    }
  }

  private func stopTrackingForPendingCommand(_ database: NativeRecorderDatabase, owner: String) throws {
    // A durable Pause/Finish intent stops acquisition even if its transition
    // cannot yet commit (for example, a full disk). Never stop a different ID.
    let pending = try database.scalarInt("""
      SELECT COUNT(*) FROM native_recorder_commands c
      JOIN native_recording_sessions s ON s.id=c.session_id AND s.owner_user_id=c.owner_user_id
      WHERE c.owner_user_id=? AND c.state='pending' AND c.action IN ('pause','finish') AND s.status<>'completed';
    """, bindings: [owner])
    if pending > 0 { DispatchQueue.main.async { self.stopPreciseTracking() } }
  }

  private func activeSession(ownerUserID: String) throws -> ActiveSession? {
    let database = try NativeRecorderDatabase()
    try stopTrackingForPendingCommand(database, owner: ownerUserID)
    try RecorderCommandJournal(database).recover(owner: ownerUserID) { self.saveCommandEvent(action: $0, sessionID: $1) }
    guard let row = try database.firstRow(
      "SELECT id,status,started_at FROM native_recording_sessions WHERE owner_user_id=? AND status<>'completed' ORDER BY created_at DESC LIMIT 1;",
      bindings: [ownerUserID]
    ), row.count == 3, let id = row[0], let status = row[1], let started = row[2], let startedAt = parseISO(started) else { return nil }
    return ActiveSession(id: id, status: status, startedAt: startedAt)
  }

  private func saveEvent(_ kind: String, sessionID: String?) {
    let occurredAt = iso(Date())
    defaults.set(kind, forKey: RecorderDefaults.lastEvent)
    defaults.set(occurredAt, forKey: RecorderDefaults.lastEventAt)
    let status = kind.contains("failed") ? "failed" : kind == "paused" ? "paused"
      : ((kind.contains("finish") || kind == "finished") ? "finished" : "recording")
    eventSequence += 1
    let event = RecorderTransitionEvent(streamID: eventStreamID, sequence: eventSequence, status: status, sessionID: sessionID, occurredAt: occurredAt)
    if let observer = transitionObserver?.callback { DispatchQueue.main.async { observer(event) } }
    Task { await JourneyDeckWatchBridge.shared.publish() }
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
      locationStateGeneration += 1
    }
  }

  private func stopSignificantMonitoring() {
    if significantMonitoring {
      locationManager.stopMonitoringSignificantLocationChanges()
      significantMonitoring = false
      locationStateGeneration += 1
    }
    // The recorder queue reconciles precise GPS from the committed session.
    // Do not read its movement state from the main queue to make that decision.
  }

  private func startPreciseTrackingIfAuthorized() {
    guard locationManager.authorizationStatus == .authorizedAlways else {
      setLastError("always_location_required")
      return
    }
    guard !preciseTracking else { return }
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    // Stationary callbacks are required for the manual ten-minute safeguard.
    locationManager.distanceFilter = kCLDistanceFilterNone
    locationManager.allowsBackgroundLocationUpdates = true
    locationManager.startUpdatingLocation()
    preciseTracking = true
    locationStateGeneration += 1
  }

  private func startConfirmationBurstIfAuthorized() {
    startPreciseTrackingIfAuthorized()
    guard preciseTracking else { return }
    cancelConfirmationBurst()
    let timer = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.workQueue.async {
        guard self.state.automaticSessionID == nil else { return }
        if let owner = self.configuredIdentity()?.owner { try? self.resetCandidate(owner: owner) }
        self.preRollLocations = []
        DispatchQueue.main.async { self.stopPreciseTracking() }
      }
    }
    confirmationBurstTimer = timer
    DispatchQueue.main.asyncAfter(deadline: .now() + driveStartConfirmationGrace, execute: timer)
  }

  private func cancelConfirmationBurst() {
    confirmationBurstTimer?.cancel()
    confirmationBurstTimer = nil
  }

  private func stopPreciseTracking() {
    cancelConfirmationBurst()
    guard preciseTracking else { return }
    locationManager.stopUpdatingLocation()
    locationManager.allowsBackgroundLocationUpdates = false
    preciseTracking = false
    locationStateGeneration += 1
  }

  private func resetCandidate(owner: String) throws {
    var nextState = state
    nextState.candidateStartedAt = nil
    nextState.candidateLastAt = nil
    nextState.candidateSamples = 0
    try commitState(nextState, owner: owner, sessionID: nextState.automaticSessionID)
    candidateLocations = []
  }

  private func saveCommandEvent(action: String, sessionID: String) {
    switch action {
    case "start": saveEvent("manual_started", sessionID: sessionID)
    case "pause": saveEvent("paused", sessionID: sessionID)
    case "resume": saveEvent("resumed", sessionID: sessionID)
    case "finish": saveEvent(sessionID.hasPrefix(manualSessionPrefix) ? "manual_finished" : "finished", sessionID: sessionID)
    default: break
    }
  }

  private func appendPreRoll(_ location: CLLocation) {
    let cutoff = location.timestamp.addingTimeInterval(-driveStartPreRollWindow)
    preRollLocations = (preRollLocations + [location])
      .filter { $0.timestamp >= cutoff && validForDetection($0) }
      .sorted { $0.timestamp < $1.timestamp }
    if preRollLocations.count > driveStartPreRollLimit {
      preRollLocations.removeFirst(preRollLocations.count - driveStartPreRollLimit)
    }
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

  private func commitState(_ nextState: DurableDetectionState, owner: String, sessionID: String?,
                           relatedWrites: ((NativeRecorderDatabase) throws -> Void)? = nil) throws {
    guard !owner.isEmpty, let data = try? JSONEncoder().encode(nextState),
          let json = String(data: data, encoding: .utf8) else { throw NativeRecorderError.notConfigured }
    let database = try NativeRecorderDatabase()
    try RecorderStateMachine(database).saveCheckpoint(owner: owner, sessionID: sessionID,
      stateJSON: json, occurredAt: iso(Date())) { try relatedWrites?(database) }
    state = nextState
  }

  private func restoreCheckpoint(database: NativeRecorderDatabase, identity: (owner: String, device: String), session: ActiveSession) throws {
    let machine = RecorderStateMachine(database)
    var json = try machine.loadCheckpoint(owner: identity.owner, sessionID: session.id)
    if json == nil, let legacy = defaults.data(forKey: RecorderDefaults.durableState) {
      if let decoded = try? JSONDecoder().decode(DurableDetectionState.self, from: legacy),
         decoded.automaticSessionID == session.id, let imported = String(data: legacy, encoding: .utf8) {
        // Remove the legacy value only after the SQLite commit. A transient
        // write failure retries migration instead of silently losing recovery.
        try machine.saveCheckpoint(owner: identity.owner, sessionID: session.id,
          stateJSON: imported, occurredAt: iso(Date()))
        json = imported
      }
    }
    // A matching value has committed, or the value is stale/malformed. Either
    // way UserDefaults is no longer a continuing authority.
    defaults.removeObject(forKey: RecorderDefaults.durableState)
    var restored = DurableDetectionState.empty
    if let json, let data = json.data(using: .utf8),
       let decoded = try? JSONDecoder().decode(DurableDetectionState.self, from: data),
       decoded.automaticSessionID == session.id { restored = decoded }
    restored.automaticSessionID = session.id
    let commandSequence = Int(try database.scalarInt(
      "SELECT COALESCE(MAX(sequence),0) FROM native_recorder_commands WHERE owner_user_id=? AND state='applied';",
      bindings: [identity.owner]))
    if restored.lastCommandSequence != commandSequence {
      restored.lastCommandSequence = commandSequence
      restored.manualInactivity = nil
      restored.stoppedSince = nil
      lastLocation = nil
      guard let data = try? JSONEncoder().encode(restored), let sanitized = String(data: data, encoding: .utf8) else {
        throw NativeRecorderError.databaseSchema
      }
      try machine.saveCheckpoint(owner: identity.owner, sessionID: session.id,
        stateJSON: sanitized, occurredAt: iso(Date()))
    }
    state = restored
  }

  private func setLastError(_ code: String?) {
    let apply = {
      let previous = self.defaults.string(forKey: RecorderDefaults.lastError)
      guard previous != code else { return }
      if let code {
        self.defaults.set(code, forKey: RecorderDefaults.lastError)
        self.saveEvent("status_failed", sessionID: self.state.automaticSessionID)
      } else {
        self.defaults.removeObject(forKey: RecorderDefaults.lastError)
      }
    }
    if DispatchQueue.getSpecific(key: workQueueKey) != nil { apply() }
    else { workQueue.async(execute: apply) }
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
  private var transitionObserverToken: UUID?

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckRecorder")
    Events("recorderStatusChanged")

    AsyncFunction("askJourneyDeckAsync") { (question: String, userID: String, contextToken: String?) async -> [String: Any] in
      await JourneyDeckAskService.shared.answer(question: question, expectedUserID: userID, contextToken: contextToken)
    }

    AsyncFunction("resolveJourneyDeckAnswerAsync") { (ticket: String, userID: String) async -> [String: Any] in
      await JourneyDeckAskService.shared.resolve(ticket: ticket, expectedUserID: userID)
    }

    AsyncFunction("journeyDeckAIStatusAsync") { () async -> [String: Any] in
      await JourneyDeckAskService.shared.aiStatus()
    }
    AsyncFunction("journeyDeckEvaluationCasesAsync") { () async -> [[String: Any]] in
      await JourneyDeckAskService.shared.evaluationCases()
    }
    AsyncFunction("evaluateJourneyDeckCaseAsync") { (id: String) async -> [String: Any] in
      await JourneyDeckAskService.shared.evaluateCase(id: id)
    }
    AsyncFunction("cancelJourneyDeckEvaluationAsync") { () async in
      await JourneyDeckAskService.shared.cancelEvaluation()
    }

    Constant("displayLayoutObserverAvailable") { true }

    View(JourneyDeckDisplayLayoutObserver.self) {
      Events("onDisplayLayoutChange")
    }

    OnCreate {
      self.transitionObserverToken = JourneyDeckNativeRecorder.shared.setTransitionObserver { [weak self] event in
        self?.sendEvent("recorderStatusChanged", event.payload)
      }
      DispatchQueue.main.async { JourneyDeckNativeRecorder.shared.bootstrap() }
    }

    OnDestroy {
      if let token = self.transitionObserverToken {
        JourneyDeckNativeRecorder.shared.removeTransitionObserver(token: token)
        self.transitionObserverToken = nil
      }
    }

    AsyncFunction("configureAsync") { (enabled: Bool, ownerUserID: String, deviceID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.configure(enabled: enabled, ownerUserID: ownerUserID, deviceID: deviceID)
    }

    AsyncFunction("executeCommandAsync") { (operationID: String, action: String, sessionID: String, controlToken: String, expiresAt: Double) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.executeCommand(operationID: operationID, action: action, sessionID: sessionID, expectedToken: controlToken, expiresAt: expiresAt)
    }
    AsyncFunction("getCommandOutcomeAsync") { (operationID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.commandOutcome(operationID: operationID)
    }

    AsyncFunction("createMarkerAsync") { (operationID: String, sessionID: String, token: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.createMarker(operationID: operationID, sessionID: sessionID, expectedToken: token)
    }

    AsyncFunction("getStatusAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.status()
    }

    AsyncFunction("configureManualAsync") { (ready: Bool, ownerUserID: String, legacyActive: Bool) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.configureManual(ready: ready, ownerUserID: ownerUserID, legacyActive: legacyActive)
    }

    AsyncFunction("startManualJourneyAsync") { (requestID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.startManual(requestID: requestID)
    }

    AsyncFunction("pauseActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.pause()
    }

    AsyncFunction("resumeActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.resume()
    }

    AsyncFunction("pauseJourneyIfMatchingAsync") { (sessionID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.pause(expectedSessionID: sessionID)
    }

    AsyncFunction("resumeJourneyIfMatchingAsync") { (sessionID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.resume(expectedSessionID: sessionID)
    }

    AsyncFunction("finishActiveJourneyAsync") { () async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.finish()
    }

    AsyncFunction("finishJourneyIfMatchingAsync") { (sessionID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.finish(expectedSessionID: sessionID)
    }

    AsyncFunction("exportInboxAsync") { (afterSequences: [String: Int]) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.exportInbox(afterSequences: afterSequences)
    }

    AsyncFunction("exportInboxForSessionAsync") { (afterSequences: [String: Int], sessionID: String) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.exportInbox(afterSequences: afterSequences, preferredSessionID: sessionID)
    }

    AsyncFunction("acknowledgeCompletedSessionsAsync") { (sessionIDs: [String]) async -> [String: Any] in
      await JourneyDeckNativeRecorder.shared.acknowledgeCompletedSessions(sessionIDs)
    }

    AsyncFunction("nearbyPointsOfInterestAsync") { (latitude: Double, longitude: Double, radiusMeters: Double) async -> [[String: Any]] in
      await JourneyDeckNativeRecorder.shared.nearbyPointsOfInterest(latitude: latitude, longitude: longitude, radiusMeters: radiusMeters)
    }
  }
}
