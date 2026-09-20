import Foundation

// Standalone acceptance tests for the production SQLite state machine.  The
// native runner should compile this file alongside NativeRecorderDatabase,
// RecorderStateMachine, and RecorderCommandJournal.
@main struct RecorderStateMachineTests {
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("journeydeck-state-machine-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }

    let db = try NativeRecorderDatabase(directoryOverride: directory)
    let machine = RecorderStateMachine(db)
    let journal = RecorderCommandJournal(db)
    let started = "2026-09-12T12:00:00Z"
    let later = "2026-09-12T12:01:00Z"

    func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
      precondition(condition(), message)
    }
    func throwsError(_ work: () throws -> Void) -> Bool {
      do { try work(); return false } catch { return true }
    }
    func status(_ owner: String) throws -> String? {
      try db.firstRow(
        "SELECT status FROM native_recording_sessions WHERE owner_user_id=? AND status<>'completed';",
        bindings: [owner]
      )?[0]
    }
    func pointCount() throws -> Int {
      Int(try db.scalarInt("SELECT COUNT(*) FROM native_recording_points;"))
    }

    let start = try machine.apply(.init(
      action: .start, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_a", occurredAt: started,
      startedAt: started, checkpoint: "{\"candidateSamples\":0}",
      operationID: nil, permitRestartStart: true))
    expect(start.applied && start.status == "recording", "Start applies")

    // A terminal session cannot be changed by a late command, including from
    // another owner.  This is the identity fence used by phone and Watch.
    let finish = try machine.apply(.init(
      action: .finish, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_a", occurredAt: later,
      startedAt: nil, checkpoint: "{\"candidateSamples\":0}",
      operationID: nil, permitRestartStart: false))
    let afterFinish = try status("owner-a")
    expect(finish.applied && afterFinish == nil, "Finish is terminal")
    let terminalResume = try machine.apply(.init(
      action: .resume, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_a", occurredAt: later,
      startedAt: nil, checkpoint: nil, operationID: nil, permitRestartStart: false))
    expect(!terminalResume.applied && terminalResume.errorCode == "session_changed",
           "Terminal session rejects a late Resume")
    let foreign = try machine.apply(.init(
      action: .pause, source: .watch, owner: "owner-b", device: "watch",
      sessionID: "native_recording_manual_a", occurredAt: later,
      startedAt: nil, checkpoint: nil, operationID: nil, permitRestartStart: false))
    expect(!foreign.applied && foreign.errorCode == "session_changed", "Foreign owner is fenced")

    // Recreate an active session for transaction-boundary checks.
    let active = try machine.apply(.init(
      action: .start, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_b", occurredAt: later,
      startedAt: later, checkpoint: "{\"candidateSamples\":1}",
      operationID: nil, permitRestartStart: true))
    expect(active.applied, "Second session starts after terminal completion")
    try journal.submit(operationID: "pause-op", owner: "owner-a", device: "phone",
                       action: "pause", sessionID: "native_recording_manual_b", issuedAt: later)

    // The point insert, checkpoint projection, session transition, and command
    // receipt must share one transaction.  A receipt write failure after the
    // related point/checkpoint writes must
    // leave all four pieces exactly as they were before apply().
    try db.execute("""
      CREATE TRIGGER fail_receipt AFTER UPDATE ON native_recorder_commands
      WHEN NEW.operation_id='pause-op'
      BEGIN SELECT RAISE(ABORT,'injected_receipt_failure'); END;
    """)
    let rollbackFailed = throwsError {
      _ = try machine.apply(.init(
        action: .pause, source: .phone, owner: "owner-a", device: "phone",
        sessionID: "native_recording_manual_b", occurredAt: later,
        startedAt: nil, checkpoint: "{\"candidateSamples\":2}",
        operationID: "pause-op", permitRestartStart: false), relatedWrites: {
          try db.execute("INSERT INTO native_recording_points(session_id,sequence,recorded_at,latitude,longitude) VALUES(?,?,?,?,?);",
                         bindings: ["native_recording_manual_b", 0, later, 41.0, -87.0])
        })
    }
    expect(rollbackFailed, "Injected receipt failure aborts apply")
    try db.execute("DROP TRIGGER fail_receipt;")
    let rolledBackStatus = try status("owner-a")
    let rolledBackPoints = try pointCount()
    let rolledBackReceipt = try journal.outcome(operationID: "pause-op", owner: "owner-a")["state"] as? String
    let rolledBackCheckpoint = try RecorderStateMachine(db).loadCheckpoint(owner: "owner-a", sessionID: "native_recording_manual_b")
    expect(rolledBackStatus == "recording", "Failed receipt rolls back session transition")
    expect(rolledBackPoints == 0, "Failed receipt rolls back related point")
    expect(rolledBackReceipt == "pending", "Failed receipt retains pending command")
    expect(rolledBackCheckpoint == "{\"candidateSamples\":1}", "Failed receipt preserves prior candidate")

    // An idle checkpoint has no session identity and is allowed only while the
    // owner is idle. It must not overwrite an active session checkpoint, and a
    // session checkpoint must never be writable through another owner.
    let idleWhileActiveRejected = throwsError {
      try machine.saveCheckpoint(owner: "owner-a", sessionID: nil,
                                 stateJSON: "{\"candidateSamples\":9}", occurredAt: later)
    }
    expect(idleWhileActiveRejected, "Idle checkpoint is rejected while a session is active")
    let foreignCheckpointRejected = throwsError {
      try machine.saveCheckpoint(owner: "owner-b", sessionID: "native_recording_manual_b",
                                 stateJSON: "{\"candidateSamples\":9}", occurredAt: later)
    }
    expect(foreignCheckpointRejected, "Cross-owner checkpoint is rejected")
    let retainedActiveCheckpoint = try RecorderStateMachine(db).loadCheckpoint(owner: "owner-a", sessionID: "native_recording_manual_b")
    expect(retainedActiveCheckpoint == "{\"candidateSamples\":1}", "Rejected checkpoints preserve active state")

    // Idle candidates are persisted in the same table and survive a separate
    // database connection once the active session has been completed.
    let completeActive = try machine.apply(.init(
      action: .finish, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_b", occurredAt: later,
      startedAt: nil, checkpoint: nil, operationID: nil, permitRestartStart: false))
    expect(completeActive.applied, "Active session can finish before idle checkpoint")
    try machine.saveCheckpoint(owner: "owner-a", sessionID: nil,
                               stateJSON: "{\"candidateSamples\":7}", occurredAt: later)
    let idleReopened = try NativeRecorderDatabase(directoryOverride: directory)
    let idleCandidate = try RecorderStateMachine(idleReopened).loadIdleCheckpoint(owner: "owner-a")
    expect(idleCandidate == "{\"candidateSamples\":7}", "Idle candidate survives reopen")

    // A receipt is an immutable authorization. A foreign owner cannot apply
    // it, and replaying an already-resolved receipt cannot run related writes.
    try journal.submit(operationID: "foreign-receipt", owner: "owner-a", device: "phone",
                       action: "start", sessionID: "native_recording_manual_c", issuedAt: later)
    let foreignReceiptRejected = throwsError {
      _ = try machine.apply(.init(
        action: .start, source: .phone, owner: "owner-b", device: "phone",
        sessionID: "native_recording_manual_c", occurredAt: later,
        startedAt: later, checkpoint: nil, operationID: "foreign-receipt", permitRestartStart: true))
    }
    expect(foreignReceiptRejected, "Foreign receipt is rejected")

    try journal.submit(operationID: "resolved-receipt", owner: "owner-a", device: "phone",
                       action: "start", sessionID: "native_recording_manual_d", issuedAt: later)
    var relatedWriteCount = 0
    let firstResolved = try machine.apply(.init(
      action: .start, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_d", occurredAt: later,
      startedAt: later, checkpoint: nil, operationID: "resolved-receipt", permitRestartStart: true),
      relatedWrites: { relatedWriteCount += 1 })
    expect(firstResolved.applied && relatedWriteCount == 1, "First receipt executes related writes")
    let replayResolved = try machine.apply(.init(
      action: .start, source: .phone, owner: "owner-a", device: "phone",
      sessionID: "native_recording_manual_d", occurredAt: later,
      startedAt: later, checkpoint: nil, operationID: "resolved-receipt", permitRestartStart: true),
      relatedWrites: { relatedWriteCount += 1 })
    expect(replayResolved.applied && relatedWriteCount == 1, "Resolved receipt does not replay related writes")

    // Duplicate IDs bind the complete command payload, while an exact replay
    // remains idempotent.
    try journal.submit(operationID: "duplicate", owner: "owner-a", device: "phone",
                       action: "pause", sessionID: "native_recording_manual_b", issuedAt: later)
    try journal.submit(operationID: "duplicate", owner: "owner-a", device: "phone",
                       action: "pause", sessionID: "native_recording_manual_b", issuedAt: later)
    let duplicateConflict = throwsError {
      try journal.submit(operationID: "duplicate", owner: "owner-a", device: "watch",
                         action: "finish", sessionID: "native_recording_manual_b", issuedAt: later)
    }
    expect(duplicateConflict, "Conflicting duplicate ID fails")
    let foreignReceipt = try journal.outcome(operationID: "duplicate", owner: "owner-b")["state"] as? String
    expect(foreignReceipt == "unknown", "Command receipts are owner scoped")

    print("Recorder state machine tests passed")
  }
}
