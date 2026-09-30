import SwiftUI
import WatchConnectivity
import WatchKit

@main
struct JourneyDeckWatchApp: App {
  @StateObject private var recorder = WatchRecorder()
  @Environment(\.scenePhase) private var phase

  var body: some Scene {
    WindowGroup {
      CinematicJourneyScreen(recorder: recorder)
      .task(id: phase) {
        guard phase == .active else { recorder.invalidate(); return }
        while !Task.isCancelled {
          recorder.refresh()
          do { try await Task.sleep(nanoseconds: 5_000_000_000) } catch { return }
        }
      }
    }
  }
}

// Grand Touring, the default theme: the same navy, champagne and ivory as the iOS Start a Journey widget.
private enum WatchPalette {
  static let navy = Color(red: 8 / 255, green: 24 / 255, blue: 50 / 255)
  static let champagne = Color(red: 212 / 255, green: 177 / 255, blue: 90 / 255)
  static let ivory = Color(red: 246 / 255, green: 240 / 255, blue: 226 / 255)
}

/// Mirrors the widget: a small label, the last drive (or a first-drive invitation), and one large Start button.
@MainActor
private struct CinematicJourneyScreen: View {
  @ObservedObject var recorder: WatchRecorder
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
  @Environment(\.isLuminanceReduced) private var dimmed

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 0) {
        header
        Spacer(minLength: 8)
        Button(action: recorder.tap) {
          HStack(spacing: 8) {
            if recorder.busy { ProgressView().tint(WatchPalette.navy) }
            else if recorder.active {
              Image(systemName: "stop.fill").font(.system(size: 15, weight: .bold)).accessibilityHidden(true)
            } else {
              Circle().fill(WatchPalette.navy).frame(width: 10, height: 10).accessibilityHidden(true)
            }
            Text(recorder.buttonTitle)
              .font(.system(size: 18, weight: .bold))
              .lineLimit(1).minimumScaleFactor(0.7)
          }
          .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(GrandTouringStartButtonStyle(active: recorder.active))
        .disabled(recorder.busy)
        .accessibilityHint(recorder.active ? "Stops and saves the journey on your iPhone" : "Starts recording with your iPhone GPS")

        Text("Auto-stops after 10 min without driving")
          .font(.system(size: 11))
          .foregroundStyle(WatchPalette.ivory.opacity(0.75))
          .fixedSize(horizontal: false, vertical: true)
          .padding(.top, 8)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8).padding(.bottom, 8)
    }
    .foregroundStyle(WatchPalette.ivory)
    .background {
      GeometryReader { geometry in
        ZStack {
          WatchPalette.navy
          // Decorative bundled artwork, the same road photo as the widget; never a live map or location request.
          if !reduceTransparency && !dimmed {
            Image("RoadPhoto")
              .resizable().scaledToFill()
              .frame(width: geometry.size.width, height: geometry.size.height)
              .clipped()
            LinearGradient(stops: [
              .init(color: WatchPalette.navy.opacity(0.55), location: 0),
              .init(color: WatchPalette.navy.opacity(0.1), location: 0.35),
              .init(color: WatchPalette.navy.opacity(0.93), location: 1),
            ], startPoint: .top, endPoint: .bottom)
          }
        }
      }
      .ignoresSafeArea()
      .allowsHitTesting(false)
      .accessibilityHidden(true)
    }
  }

  @ViewBuilder private var header: some View {
    let connected = recorder.active || recorder.ready
    if recorder.active {
      label("RECORDING")
      Text(recorder.status)
        .font(.system(size: 20, weight: .semibold, design: .serif))
        .lineLimit(2).minimumScaleFactor(0.7).fixedSize(horizontal: false, vertical: true)
    } else if connected, let drive = recorder.lastDrive {
      label("LAST DRIVE")
      Text(drive.milesText)
        .font(.system(size: 26, weight: .semibold, design: .serif))
        .lineLimit(1).minimumScaleFactor(0.7)
      Text("\(drive.dayText) · \(Int(drive.minutes.rounded())) min")
        .font(.system(size: 12)).foregroundStyle(WatchPalette.ivory.opacity(0.85)).lineLimit(1)
    } else {
      label("JOURNEYDECK")
      Text(connected ? "Your first drive awaits" : recorder.status)
        .font(.system(size: connected ? 20 : 15, weight: .semibold, design: .serif))
        .lineLimit(4).minimumScaleFactor(0.7).fixedSize(horizontal: false, vertical: true)
    }
  }

  private func label(_ text: String) -> some View {
    Text(text).font(.system(size: 10, weight: .bold)).tracking(1)
      .foregroundStyle(WatchPalette.ivory.opacity(0.8))
  }
}

/// A large champagne capsule with navy text, like the widget's Start button; Stop is ivory so the state is obvious.
private struct GrandTouringStartButtonStyle: ButtonStyle {
  let active: Bool
  @Environment(\.isEnabled) private var enabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(WatchPalette.navy)
      .background(Capsule().fill(active ? WatchPalette.ivory : WatchPalette.champagne))
      .brightness(configuration.isPressed ? -0.12 : 0)
      .opacity(enabled ? 1 : 0.65)
  }
}

/// The latest drive, sent by the iPhone with its status. Only distance, minutes and the start time.
struct WatchLastDrive: Equatable {
  let miles: Double
  let minutes: Double
  let startedAt: Date

  var milesText: String { miles < 10 ? String(format: "%.1f mi", miles) : "\(Int(miles.rounded())) mi" }
  var dayText: String {
    if Calendar.current.isDateInToday(startedAt) { return "Today" }
    if Calendar.current.isDateInYesterday(startedAt) { return "Yesterday" }
    let days = Calendar.current.dateComponents([.day], from: startedAt, to: .now).day ?? 0
    return days < 7 ? startedAt.formatted(.dateTime.weekday(.wide)) : startedAt.formatted(.dateTime.month(.abbreviated).day())
  }

  init?(_ value: Any?) {
    guard let dictionary = value as? [String: Any], let miles = dictionary["miles"] as? Double,
          let minutes = dictionary["minutes"] as? Double, let iso = dictionary["startedAt"] as? String else { return nil }
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return nil }
    self.miles = miles; self.minutes = minutes; self.startedAt = date
  }
}

@MainActor
final class WatchRecorder: NSObject, ObservableObject, WCSessionDelegate {
  @Published private(set) var active = false
  @Published private(set) var busy = false
  @Published private(set) var status = "Connecting to iPhone…"
  @Published private(set) var lastDrive: WatchLastDrive?
  @Published private(set) var ready = false
  private var fresh = false
  private var sessionID: String?
  private var controlToken = ""
  private var generation = 0
  private var requestPending = false
  private var updatedAt: Double = 0

  var buttonTitle: String {
    if busy { return "Please wait…" }
    if !fresh || (!active && !ready) { return "Connect iPhone" }
    return active ? "Stop Journey" : "Start Journey"
  }

  override init() {
    super.init()
    guard WCSession.isSupported() else { status = "iPhone connection unavailable."; return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func invalidate() { fresh = false }
  func refresh() { if !requestPending { send("status") } }

  func tap() {
    guard !requestPending else { return }
    guard fresh, ready || active else { refresh(); return }
    send(active ? "stop" : "start")
  }

  private func send(_ command: String) {
    guard WCSession.default.activationState == .activated else { return }
    generation += 1
    let requestGeneration = generation
    requestPending = true
    busy = command != "status"
    var message: [String: Any] = ["version": 1, "command": command,
      "requestID": UUID().uuidString, "issuedAt": Date().timeIntervalSince1970,
      "controlToken": controlToken]
    if let sessionID { message["sessionID"] = sessionID }
    WCSession.default.sendMessage(message, replyHandler: { [weak self] response in
      Task { @MainActor in
        guard let self, self.generation == requestGeneration else { return }
        self.busy = false
        self.requestPending = false
        if let error = response["error"] as? String {
          self.fresh = false
          self.status = ["open_iphone_required", "start_failed"].contains(error)
            ? "Open JourneyDeck on iPhone and enable Always location access."
            : "Could not confirm the change. Reconnect to check."
          return
        }
        self.apply(response, confirmed: true)
        if command != "status" { WKInterfaceDevice.current().play(.success) }
      }
    }, errorHandler: { [weak self] _ in
      Task { @MainActor in
        guard let self, self.generation == requestGeneration else { return }
        self.busy = false
        self.requestPending = false
        self.fresh = false
        self.status = "Open JourneyDeck on your nearby iPhone to connect."
      }
    })
    Task { [weak self] in
      try? await Task.sleep(nanoseconds: 12_000_000_000)
      guard let self, self.generation == requestGeneration, self.requestPending else { return }
      self.generation += 1
      self.busy = false
      self.requestPending = false
      self.fresh = false
      self.status = "iPhone did not confirm. Reconnect to check."
    }
  }

  private func apply(_ message: [String: Any], confirmed: Bool) {
    guard message["version"] as? Int == 1, let time = message["updatedAt"] as? Double,
          time >= updatedAt else { return }
    updatedAt = time
    active = message["recording"] as? Bool == true || message["paused"] as? Bool == true
    ready = message["ready"] as? Bool == true
    if let drive = WatchLastDrive(message["lastDrive"]) { lastDrive = drive }
    sessionID = message["sessionID"] as? String
    controlToken = message["controlToken"] as? String ?? ""
    fresh = confirmed || (fresh && Date().timeIntervalSince1970 - time <= 15)
    if active { status = message["paused"] as? Bool == true ? "Journey paused" : "Recording on iPhone" }
    else if message["legacyActive"] as? Bool == true { status = "Finish the existing journey on iPhone first." }
    else if !ready { status = "Open JourneyDeck on iPhone and enable Always location access." }
    else { status = message["event"] as? String == "manual_auto_finished" ? "Journey stopped automatically" : "Ready for your journey" }
  }

  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    Task { @MainActor in self.refresh() }
  }
  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    Task { @MainActor in self.apply(applicationContext, confirmed: false) }
  }
  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    Task { @MainActor in self.fresh = false; self.refresh() }
  }
}
