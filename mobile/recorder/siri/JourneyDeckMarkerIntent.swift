// V3 registration is injected for both the preview and live TestFlight variants.
struct CreateJourneyMarkerIntent: AppIntent {
  static let title: LocalizedStringResource = "Create a Marker"
  static let description = IntentDescription("Save this moment and its location in the journey being recorded. Add notes, photos or a voice memo later.")
  static let openAppWhenRun = false
  func perform() async throws -> some IntentResult & ProvidesDialog {
    switch await JourneyDeckSiriRecorder.createMarker() {
    case "saved": return .result(dialog: "Marker saved to your journey.")
    case "no_active_journey": return .result(dialog: "Start or resume a journey first, then ask me to create a marker.")
    case "marker_location_unavailable": return .result(dialog: "I need a recent GPS location to save this marker. Please try again in a moment.")
    default: return .result(dialog: "I couldn't confirm the marker. Open JourneyDeck when it is safe to check.")
    }
  }
}
