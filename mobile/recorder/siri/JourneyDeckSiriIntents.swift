import AppIntents
internal import JourneyDeckRecorder

struct StartJourneyIntent: AppIntent {
  static let title: LocalizedStringResource = "Start Journey"
  static let description = IntentDescription("Start recording a journey with JourneyDeck.")
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch await JourneyDeckSiriRecorder.start() {
    case .started: return .result(dialog: "Journey started in JourneyDeck.")
    case .alreadyActive: return .result(dialog: "A journey is already active in JourneyDeck.")
    case .locationPermissionRequired:
      return .result(dialog: "Open JourneyDeck and allow Always location access before starting a journey.")
    case .setupRequired:
      return .result(dialog: "Open JourneyDeck to finish your profile setup before starting a journey.")
    default: return .result(dialog: "JourneyDeck could not start a journey. Please open the app and try again.")
    }
  }
}

struct StopJourneyIntent: AppIntent {
  static let title: LocalizedStringResource = "Stop Journey"
  static let description = IntentDescription("Stop and save the active JourneyDeck journey.")
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch await JourneyDeckSiriRecorder.stop() {
    case .stopped: return .result(dialog: "Journey stopped and saved in JourneyDeck.")
    case .noActiveJourney: return .result(dialog: "There is no active JourneyDeck journey to stop.")
    case .setupRequired: return .result(dialog: "Open JourneyDeck to finish setup before stopping a journey.")
    default: return .result(dialog: "JourneyDeck could not stop the journey. Please open the app and try again.")
    }
  }
}

struct JourneyDeckAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: StartJourneyIntent(), phrases: [
      "Start a journey in \(.applicationName)",
      "Start my \(.applicationName) journey"
    ], shortTitle: "Start Journey", systemImageName: "play.circle.fill")
    AppShortcut(intent: StopJourneyIntent(), phrases: [
      "Stop my journey in \(.applicationName)",
      "Stop my \(.applicationName) journey"
    ], shortTitle: "Stop Journey", systemImageName: "stop.circle.fill")
    // JOURNEYDECK_V3_APP_SHORTCUTS
  }
}
