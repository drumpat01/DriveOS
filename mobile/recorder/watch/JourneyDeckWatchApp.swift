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

private enum WatchPalette {
  static let night = Color(red: 8 / 255, green: 7 / 255, blue: 13 / 255)
  static let cream = Color(red: 1, green: 248 / 255, blue: 239 / 255)
  static let amber = Color(red: 1, green: 138 / 255, blue: 78 / 255)
  // JourneyDeck --jd-purple: #963CFF.
  static let purple = Color(red: 150 / 255, green: 60 / 255, blue: 1)
  static let copper = Color(red: 160 / 255, green: 70 / 255, blue: 27 / 255)
  static let deepCopper = Color(red: 62 / 255, green: 24 / 255, blue: 13 / 255)
  static let deepPurple = Color(red: 49 / 255, green: 14 / 255, blue: 87 / 255)
}

@MainActor
private struct CinematicJourneyScreen: View {
  @ObservedObject var recorder: WatchRecorder
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
  @Environment(\.isLuminanceReduced) private var dimmed
  @ScaledMetric(relativeTo: .title2) private var symbolSize = 27.0

  var body: some View {
    ScrollView {
      VStack(spacing: 6) {
        Image(systemName: recorder.active ? "car" : "steeringwheel")
          .font(.system(size: symbolSize, weight: .light))
          .foregroundStyle(WatchPalette.amber)
          .padding(9)
          .background(WatchPalette.night.opacity(reduceTransparency ? 1 : 0.82), in: Circle())
          .overlay(Circle().strokeBorder(WatchPalette.amber.opacity(0.5), lineWidth: 1))
          .accessibilityHidden(true)

        HStack(alignment: .firstTextBaseline, spacing: 5) {
          if recorder.active {
            Circle().fill(WatchPalette.amber).frame(width: 5, height: 5)
              .accessibilityHidden(true)
          }
          Text(recorder.status)
            .font(.system(.subheadline, design: .serif))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(WatchPalette.night.opacity(reduceTransparency ? 1 : 0.78), in: RoundedRectangle(cornerRadius: 10))

        Button(action: recorder.tap) {
          VStack(spacing: 6) {
            if recorder.busy { ProgressView().tint(WatchPalette.cream) }
            else {
              Image(systemName: recorder.active ? "stop.fill" : "play.fill")
                .font(.title3).accessibilityHidden(true)
            }
            Text(recorder.buttonTitle)
              .font(.system(.headline, design: .serif))
              .multilineTextAlignment(.center)
              .fixedSize(horizontal: false, vertical: true)
          }
          .frame(maxWidth: .infinity, minHeight: 58)
          .padding(.horizontal, 8).padding(.vertical, 2)
        }
        .buttonStyle(CinematicJourneyButtonStyle(active: recorder.active))
        .disabled(recorder.busy)
        .accessibilityHint(recorder.active ? "Stops and saves the journey on your iPhone" : "Starts recording with your iPhone GPS")

        Text("Journey auto-stops after 10min without driving")
          .font(.system(.footnote, design: .serif))
          .foregroundStyle(WatchPalette.cream.opacity(0.8))
          .multilineTextAlignment(.center)
          .fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, 4)
      }
      .padding(.horizontal, 8).padding(.top, 0).padding(.bottom, 8)
    }
    .foregroundStyle(WatchPalette.cream)
    .background {
      GeometryReader { geometry in
        ZStack {
          WatchPalette.night
          // Decorative bundled artwork; never a live map or location request.
          if !reduceTransparency && !dimmed {
            Image("CinematicRoad")
              .resizable().scaledToFill()
              .frame(width: geometry.size.width, height: geometry.size.height)
              .clipped()
            LinearGradient(colors: [.black.opacity(0.12), .black.opacity(0.35), WatchPalette.night],
              startPoint: .top, endPoint: .bottom)
          }
        }
      }
      .ignoresSafeArea()
      .allowsHitTesting(false)
      .accessibilityHidden(true)
    }
  }
}

private struct CinematicJourneyButtonStyle: ButtonStyle {
  let active: Bool
  @Environment(\.isEnabled) private var enabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(WatchPalette.cream)
      .background {
        RoundedRectangle(cornerRadius: 15, style: .continuous)
          .fill(LinearGradient(colors: active
            ? [WatchPalette.purple, WatchPalette.deepPurple]
            : [WatchPalette.copper, WatchPalette.deepCopper],
            startPoint: .topLeading, endPoint: .bottomTrailing))
      }
      .overlay {
        RoundedRectangle(cornerRadius: 15, style: .continuous)
          .strokeBorder((active ? WatchPalette.purple : WatchPalette.amber).opacity(0.85), lineWidth: 1)
      }
      .brightness(configuration.isPressed ? -0.12 : 0)
      .opacity(enabled ? 1 : 0.65)
  }
}

@MainActor
final class WatchRecorder: NSObject, ObservableObject, WCSessionDelegate {
  @Published private(set) var active = false
  @Published private(set) var busy = false
  @Published private(set) var status = "Connecting to iPhone…"
  private var ready = false
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
