import Foundation

// App-target App Intents call this narrow public facade. Command tokens and
// account identity remain inside the native recorder and never enter Siri output.
public enum JourneyDeckSiriCommandResult: String {
  case started
  case alreadyActive
  case stopped
  case noActiveJourney
  case locationPermissionRequired
  case setupRequired
  case unavailable
}

@MainActor
public enum JourneyDeckSiriRecorder {
  public static func createMarker() async -> String {
    guard Bundle.main.object(forInfoDictionaryKey: "JourneyDeckMarkerEnabled") as? Bool == true else { return "unavailable" }
    let recorder = JourneyDeckNativeRecorder.shared
    let status = await recorder.status()
    guard status["statusReliable"] as? Bool == true else { return "unavailable" }
    guard status["recording"] as? Bool == true,
          let session = status["sessionId"] as? String,
          let token = status["controlToken"] as? String else { return "no_active_journey" }
    let result = await recorder.createMarker(operationID: UUID().uuidString, sessionID: session, expectedToken: token)
    return result["errorCode"] as? String ?? (result["id"] is String ? "saved" : "unavailable")
  }

  public static func start() async -> JourneyDeckSiriCommandResult {
    let recorder = JourneyDeckNativeRecorder.shared
    let before = await recorder.status()
    guard before["statusReliable"] as? Bool == true else { return .unavailable }
    if before["sessionId"] as? String != nil { return .alreadyActive }
    guard before["configured"] as? Bool == true,
          before["manualReady"] as? Bool == true,
          before["legacyManualActive"] as? Bool != true else { return .setupRequired }
    guard before["authorization"] as? String == "always" else { return .locationPermissionRequired }
    guard let token = before["controlToken"] as? String, !token.isEmpty else { return .setupRequired }

    let operationID = UUID().uuidString
    let after = await recorder.executeCommand(operationID: operationID, action: "start", sessionID: "",
      expectedToken: token, expiresAt: Date().timeIntervalSince1970 + 30)
    guard after["statusReliable"] as? Bool == true else { return .unavailable }
    let command = after["command"] as? [String: Any] ?? [:]
    if command["state"] as? String == "applied",
       command["operationId"] as? String == operationID.lowercased(),
       command["sessionId"] as? String == after["sessionId"] as? String,
       after["recording"] as? Bool == true { return .started }
    if command["errorCode"] as? String == "session_changed",
       after["sessionId"] as? String != nil { return .alreadyActive }
    if command["errorCode"] as? String == "always_location_required" { return .locationPermissionRequired }
    if command["errorCode"] as? String == "open_iphone_required" { return .setupRequired }
    return .unavailable
  }

  public static func stop() async -> JourneyDeckSiriCommandResult {
    let recorder = JourneyDeckNativeRecorder.shared
    let before = await recorder.status()
    guard before["statusReliable"] as? Bool == true else { return .unavailable }
    guard let sessionID = before["sessionId"] as? String else { return .noActiveJourney }
    guard let token = before["controlToken"] as? String, !token.isEmpty else { return .setupRequired }

    let operationID = UUID().uuidString
    let after = await recorder.executeCommand(operationID: operationID, action: "finish", sessionID: sessionID,
      expectedToken: token, expiresAt: Date().timeIntervalSince1970 + 30)
    guard after["statusReliable"] as? Bool == true else { return .unavailable }
    let command = after["command"] as? [String: Any] ?? [:]
    if command["state"] as? String == "applied",
       command["operationId"] as? String == operationID.lowercased(),
       command["sessionId"] as? String == sessionID,
       after["sessionId"] as? String != sessionID { return .stopped }
    if command["errorCode"] as? String == "session_changed",
       after["sessionId"] as? String == nil { return .noActiveJourney }
    return .unavailable
  }
}
