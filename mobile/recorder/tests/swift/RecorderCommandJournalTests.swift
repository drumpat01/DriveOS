import Foundation

@main struct RecorderCommandJournalTests {
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("journeydeck-journal-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let db = try NativeRecorderDatabase(directoryOverride: directory)
    let journal = RecorderCommandJournal(db)
    let now = "2026-09-12T12:00:00Z"
    func submit(_ id: String, _ action: String, _ session: String = "session") throws {
      try journal.submit(operationID: id, owner: "owner", device: "device", action: action, sessionID: session, issuedAt: now)
    }
    func state(_ id: String) throws -> String { try journal.outcome(operationID: id, owner: "owner")["state"] as? String ?? "missing" }
    func sessionStatus() throws -> String? { try db.firstRow("SELECT status FROM native_recording_sessions WHERE id='session';")?[0] }
    func expect(_ condition: Bool, _ message: String) { precondition(condition, message) }

    try submit("start", "start")
    try journal.recover(owner: "owner", permittedOperationID: "start")
    expect(try state("start") == "applied", "Start commits its receipt")
    expect(try sessionStatus() == "recording", "Start records")
    try submit("pause", "pause")
    try journal.recover(owner: "owner")
    expect(try sessionStatus() == "paused", "Pending Pause recovers after restart")
    try submit("interrupted-resume", "resume")
    try journal.recover(owner: "owner")
    expect(try state("interrupted-resume") == "rejected", "Interrupted Resume cannot restart GPS later")
    try submit("resume", "resume")
    try journal.recover(owner: "owner", permittedOperationID: "resume")
    expect(try sessionStatus() == "recording", "Explicit Resume works")

    try submit("finish", "finish")
    try db.execute("CREATE TRIGGER fail_receipt BEFORE UPDATE ON native_recorder_commands BEGIN SELECT RAISE(ABORT,'injected'); END;")
    do { try journal.recover(owner: "owner"); preconditionFailure("write injection must fail") } catch {}
    expect(try state("finish") == "pending", "Intent survives failed receipt write")
    expect(try sessionStatus() == "recording", "Transition rolls back with its receipt")
    try db.execute("DROP TRIGGER fail_receipt;")
    // A new connection executes the production recovery logic against disk.
    let reopened = RecorderCommandJournal(try NativeRecorderDatabase(directoryOverride: directory))
    try reopened.recover(owner: "owner")
    expect(try sessionStatus() == "completed", "Finish recovers on reopen")
    try db.execute("DELETE FROM native_recording_sessions;")
    try submit("start", "start")
    try journal.recover(owner: "owner", permittedOperationID: "start")
    expect(try sessionStatus() == nil, "Replayed Start cannot recreate acknowledged journey")
    do { try submit("start", "finish"); preconditionFailure("operation IDs bind immutable payloads") }
    catch NativeRecorderError.commandConflict {}
    expect(try journal.outcome(operationID: "start", owner: "other")["state"] as? String == "unknown", "Receipts isolate profiles")

    try submit("stale-start", "start", "later")
    try journal.recover(owner: "owner")
    expect(try state("stale-start") == "rejected", "Restart cannot apply a stale Start")
    try submit("new-start", "start", "new-session")
    try journal.recover(owner: "owner", permittedOperationID: "new-start")
    try submit("stale-finish", "finish", "old-session")
    try journal.recover(owner: "owner")
    expect(try state("stale-finish") == "rejected", "Old Finish cannot stop new session")
    expect(try db.scalarInt("SELECT COUNT(*) FROM native_recording_sessions WHERE status='recording';") == 1, "Exactly one session survives")

    let machine = RecorderStateMachine(db)
    _ = try machine.apply(.init(action: .checkpoint, source: .automatic, owner: "owner", device: "device",
      sessionID: "new-session", occurredAt: now, startedAt: nil, checkpoint: "{\"automaticSessionID\":\"new-session\"}",
      operationID: nil, permitRestartStart: false))
    expect(try machine.loadCheckpoint(owner: "owner", sessionID: "new-session") != nil, "Checkpoint persists per owner and session")
    try db.execute("CREATE TRIGGER fail_checkpoint BEFORE UPDATE ON native_recorder_checkpoints BEGIN SELECT RAISE(ABORT,'injected'); END;")
    do {
      _ = try machine.apply(.init(action: .pause, source: .phone, owner: "owner", device: "device",
        sessionID: "new-session", occurredAt: now, startedAt: nil, checkpoint: "{}", operationID: nil, permitRestartStart: false))
      preconditionFailure("checkpoint failure must roll back lifecycle")
    } catch {}
    expect(try db.firstRow("SELECT status FROM native_recording_sessions WHERE id='new-session';")?[0] == "recording", "Checkpoint failure rolls back session status")
    print("Recorder command journal tests passed")
  }
}
