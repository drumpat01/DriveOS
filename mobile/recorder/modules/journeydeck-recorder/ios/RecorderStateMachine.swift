import Foundation

enum RecorderTransitionAction: String { case start, pause, resume, finish, checkpoint }
enum RecorderTransitionSource: String { case phone, watch, automatic, inactivity, recovery }
enum RecorderGPSDirective { case start, stop, unchanged }

struct RecorderTransitionRequest {
  let action: RecorderTransitionAction
  let source: RecorderTransitionSource
  let owner: String
  let device: String
  let sessionID: String?
  let occurredAt: String
  let startedAt: String?
  let checkpoint: String?
  let operationID: String?
  let permitRestartStart: Bool
}
struct RecorderTransitionResult {
  let applied: Bool
  let errorCode: String?
  let status: String?
  let gps: RecorderGPSDirective
}
struct RecorderTransitionEvent {
  let streamID: String
  let sequence: Int
  let status: String
  let sessionID: String?
  let occurredAt: String
  var payload: [String: Any] {
    ["streamId": streamID, "sequence": sequence, "status": status,
     "journeyId": sessionID.map { $0 as Any } ?? NSNull(), "occurredAt": occurredAt]
  }
}

// Sole database writer for lifecycle transitions and recovery checkpoints.
final class RecorderStateMachine {
  static let checkpointSchema = """
    CREATE TABLE IF NOT EXISTS native_recorder_checkpoints(
      owner_user_id TEXT PRIMARY KEY NOT NULL, session_id TEXT, state_json TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES native_recording_sessions(id) ON DELETE CASCADE
    );
  """
  static let startSQL = "INSERT INTO native_recording_sessions(id,owner_user_id,device_id,status,started_at,created_at,updated_at) VALUES(?,?,?,'recording',?,?,?);"
  static let transitionSQL = "UPDATE native_recording_sessions SET status=?,updated_at=? WHERE id=? AND owner_user_id=? AND status IN ('recording','paused');"
  static let finishSQL = "UPDATE native_recording_sessions SET status='completed',ended_at=COALESCE(ended_at,MAX(started_at,?)),updated_at=? WHERE id=? AND owner_user_id=? AND status<>'completed';"
  static let receiptSQL = "UPDATE native_recorder_commands SET state=?,error_code=? WHERE operation_id=? AND owner_user_id=? AND state='pending';"
  static let checkpointSQL = "INSERT INTO native_recorder_checkpoints(owner_user_id,session_id,state_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET session_id=excluded.session_id,state_json=excluded.state_json,updated_at=excluded.updated_at;"
  static let deleteCheckpointSQL = "DELETE FROM native_recorder_checkpoints WHERE owner_user_id=?;"
  private let database: NativeRecorderDatabase
  init(_ database: NativeRecorderDatabase) { self.database = database }

  func apply(_ request: RecorderTransitionRequest, relatedWrites: () throws -> Void = {}) throws -> RecorderTransitionResult {
    var result = RecorderTransitionResult(applied: false, errorCode: nil, status: nil, gps: .unchanged)
    try database.transaction {
      let current = try database.firstRow(
        "SELECT id,status FROM native_recording_sessions WHERE owner_user_id=? AND status<>'completed';",
        bindings: [request.owner])

      // The journal is an input to this same transition boundary. A receipt for
      // another payload, or one already resolved, cannot authorize another write.
      if let operationID = request.operationID {
        guard let command = try database.firstRow(
          "SELECT owner_user_id,device_id,action,session_id,state,error_code FROM native_recorder_commands WHERE operation_id=?;",
          bindings: [operationID]),
          Array(command.prefix(4)) == [request.owner, request.device, request.action.rawValue, request.sessionID]
        else { throw NativeRecorderError.commandConflict }
        if command[4] != "pending" {
          result = .init(applied: command[4] == "applied", errorCode: command[5], status: current?[1], gps: .unchanged)
          return
        }
      }

      var error: String?
      if request.action != .checkpoint && (request.sessionID?.isEmpty != false) {
        error = "session_changed"
      } else if (request.action == .start || request.action == .resume)
                  && request.source == .recovery && !request.permitRestartStart {
        error = "command_interrupted"
      } else if request.action == .start {
        if current != nil {
          error = "session_changed"
        } else {
          let started = request.startedAt ?? request.occurredAt
          try database.execute(Self.startSQL, bindings: [request.sessionID, request.owner, request.device,
                                                        started, request.occurredAt, request.occurredAt])
        }
      } else if current?[0] != request.sessionID {
        error = "session_changed"
      } else if request.action == .finish {
        try database.execute(Self.finishSQL, bindings: [request.occurredAt, request.occurredAt,
                                                       request.sessionID, request.owner])
      } else if current?[1] == "finishing" {
        error = "session_finishing"
      } else if request.action == .pause || request.action == .resume {
        try database.execute(Self.transitionSQL, bindings: [request.action == .pause ? "paused" : "recording",
                                                           request.occurredAt, request.sessionID, request.owner])
      }

      if error == nil {
        if request.action == .finish || (request.action != .checkpoint && request.checkpoint == nil) {
          // A lifecycle command without a supplied checkpoint starts a fresh
          // movement interval. This reset is atomic with the command receipt.
          try database.execute(Self.deleteCheckpointSQL, bindings: [request.owner])
        } else if let checkpoint = request.checkpoint {
          try database.execute(Self.checkpointSQL, bindings: [request.owner, request.sessionID,
                                                             checkpoint, request.occurredAt])
        }
        try relatedWrites()
      }
      if let operationID = request.operationID {
        try database.execute(Self.receiptSQL, bindings: [error == nil ? "applied" : "rejected",
                                                        error, operationID, request.owner])
      }

      var status = current?[1]
      var gps = RecorderGPSDirective.unchanged
      if error == nil {
        switch request.action {
        case .start, .resume: status = "recording"; gps = .start
        case .pause: status = "paused"; gps = .stop
        case .finish: status = "completed"; gps = .stop
        case .checkpoint: break
        }
      }
      result = .init(applied: error == nil, errorCode: error, status: status, gps: gps)
    }
    return result
  }

  func loadCheckpoint(owner: String, sessionID: String) throws -> String? {
    try database.firstRow("SELECT state_json FROM native_recorder_checkpoints WHERE owner_user_id=? AND session_id=?;", bindings: [owner, sessionID])?[0]
  }

  func loadIdleCheckpoint(owner: String) throws -> String? {
    try database.firstRow("SELECT state_json FROM native_recorder_checkpoints WHERE owner_user_id=? AND session_id IS NULL;", bindings: [owner])?[0]
  }

  func saveCheckpoint(owner: String, sessionID: String?, stateJSON: String, occurredAt: String,
                      relatedWrites: () throws -> Void = {}) throws {
    let result = try apply(.init(action: .checkpoint, source: .recovery, owner: owner, device: "",
      sessionID: sessionID, occurredAt: occurredAt, startedAt: nil, checkpoint: stateJSON,
      operationID: nil, permitRestartStart: false), relatedWrites: relatedWrites)
    guard result.applied else { throw NativeRecorderError.commandConflict }
  }
}
