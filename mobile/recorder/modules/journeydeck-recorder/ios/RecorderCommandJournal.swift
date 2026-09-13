import Foundation

// All access is on the recorder workQueue. Receipts outlive inbox acknowledgement:
// deleting a completed session must never make a repeated Start create it again.
final class RecorderCommandJournal {
  static let schema = """
    CREATE TABLE IF NOT EXISTS native_recorder_commands(
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('start','pause','resume','finish')),
      session_id TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','applied','rejected')),
      error_code TEXT
    );
  """

  private let database: NativeRecorderDatabase
  init(_ database: NativeRecorderDatabase) { self.database = database }

  func submit(operationID: String, owner: String, device: String, action: String,
              sessionID: String, issuedAt: String) throws {
    if let existing = try database.firstRow("SELECT owner_user_id,device_id,action,session_id FROM native_recorder_commands WHERE operation_id=?;", bindings: [operationID]) {
      guard existing == [owner, device, action, sessionID] else { throw NativeRecorderError.commandConflict }
      return
    }
    // Intent commits first. A failure in the subsequent transition leaves a
    // recoverable pending row; no acknowledgement is manufactured for it.
    try database.execute("INSERT INTO native_recorder_commands(operation_id,owner_user_id,device_id,action,session_id,issued_at) VALUES(?,?,?,?,?,?);",
                         bindings: [operationID, owner, device, action, sessionID, issuedAt])
  }

  func recover(owner: String, permittedOperationID: String? = nil,
               onApplied: ((String, String) -> Void)? = nil) throws {
    let rows = try database.rows("SELECT operation_id,action,session_id,issued_at FROM native_recorder_commands WHERE owner_user_id=? AND state='pending' ORDER BY sequence;", bindings: [owner])
    for row in rows {
      guard let operationID = row[0] as? String, let action = row[1] as? String,
            let sessionID = row[2] as? String, let issuedAt = row[3] as? String else { throw NativeRecorderError.databaseSchema }
      let device = try database.firstRow("SELECT device_id FROM native_recorder_commands WHERE operation_id=?;", bindings: [operationID])?[0] ?? ""
      guard let transition = RecorderTransitionAction(rawValue: action) else { throw NativeRecorderError.databaseSchema }
      let result = try RecorderStateMachine(database).apply(.init(action: transition,
        source: permittedOperationID == operationID ? .phone : .recovery, owner: owner, device: device,
        sessionID: sessionID, occurredAt: issuedAt, startedAt: issuedAt, checkpoint: nil,
        operationID: operationID, permitRestartStart: permittedOperationID == operationID))
      if result.applied { onApplied?(action, sessionID) }
    }
  }

  func outcome(operationID: String, owner: String) throws -> [String: Any] {
    guard let row = try database.firstRow("SELECT action,session_id,state,error_code FROM native_recorder_commands WHERE operation_id=? AND owner_user_id=?;", bindings: [operationID, owner]) else {
      return ["operationId": operationID, "state": "unknown"]
    }
    return ["operationId": operationID, "action": row[0] ?? "", "sessionId": row[1] ?? "",
            "state": row[2] ?? "unknown", "errorCode": row[3].map { $0 as Any } ?? NSNull()]
  }
}
