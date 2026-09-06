import Foundation
import WatchConnectivity

// Watch messages contain control state only: no route, account, music or secrets.
final class JourneyDeckWatchBridge: NSObject, WCSessionDelegate {
  static let shared = JourneyDeckWatchBridge()
  private var commandInFlight = false
  private let receiptsKey = "journeydeck.watch.receipts-v1"

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func snapshot() async -> [String: Any] {
    let status = await JourneyDeckNativeRecorder.shared.status()
    guard status["statusReliable"] as? Bool == true else { return ["error": "recorder_unavailable"] }
    var result: [String: Any] = [
      "version": 1, "updatedAt": Date().timeIntervalSince1970,
      "recording": status["recording"] as? Bool ?? false,
      "paused": status["paused"] as? Bool ?? false,
      "ready": (status["manualReady"] as? Bool == true) && (status["authorization"] as? String == "always"),
      "legacyActive": status["legacyManualActive"] as? Bool ?? false,
      "controlToken": status["controlToken"] as? String ?? ""
    ]
    if let id = status["sessionId"] as? String { result["sessionID"] = id }
    if let event = status["lastEvent"] as? String { result["event"] = event }
    return result
  }

  func publish() async {
    let payload = await snapshot()
    await MainActor.run {
      guard WCSession.isSupported(), WCSession.default.activationState == .activated,
            WCSession.default.isPaired, WCSession.default.isWatchAppInstalled else { return }
      try? WCSession.default.updateApplicationContext(payload)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    Task { await publish() }
  }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }
  func sessionWatchStateDidChange(_ session: WCSession) { Task { await publish() } }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    Task { @MainActor in
      guard message["version"] as? Int == 1,
            let command = message["command"] as? String,
            ["status", "start", "stop"].contains(command) else {
        replyHandler(["error": "update_required"]); return
      }
      if command == "status" { replyHandler(await snapshot()); return }
      guard !commandInFlight else { replyHandler(["error": "busy"]); return }
      guard let requestID = message["requestID"] as? String, UUID(uuidString: requestID) != nil,
            let issuedAt = message["issuedAt"] as? Double,
            abs(Date().timeIntervalSince1970 - issuedAt) <= 30 else {
        replyHandler(["error": "expired"]); return
      }
      commandInFlight = true
      defer { commandInFlight = false }
      var receipts = UserDefaults.standard.stringArray(forKey: receiptsKey) ?? []
      if receipts.contains(requestID) { replyHandler(await snapshot()); return }
      let current = await snapshot()
      guard let token = message["controlToken"] as? String, !token.isEmpty,
            token == current["controlToken"] as? String else {
        replyHandler(["error": "refresh_required"]); return
      }
      // Do not queue start/stop with transferUserInfo: delayed controls must
      // never start a journey hours later or stop a different journey.
      if command == "start" {
        guard current["ready"] as? Bool == true else { replyHandler(["error": "open_iphone_required"]); return }
        let status = await JourneyDeckNativeRecorder.shared.startManual(requestID: requestID, expectedToken: token)
        guard status["recording"] as? Bool == true || status["paused"] as? Bool == true else {
          replyHandler(["error": "start_failed"]); return
        }
      } else {
        guard let expected = message["sessionID"] as? String, !expected.isEmpty else {
          replyHandler(["error": "refresh_required"]); return
        }
        let status = await JourneyDeckNativeRecorder.shared.finish(expectedSessionID: expected)
        if status["sessionId"] as? String == expected || status["lastErrorCode"] is String || status["statusReliable"] as? Bool != true {
          replyHandler(["error": "stop_failed"]); return
        }
      }
      receipts.append(requestID)
      UserDefaults.standard.set(Array(receipts.suffix(64)), forKey: receiptsKey)
      replyHandler(await snapshot())
    }
  }
}
