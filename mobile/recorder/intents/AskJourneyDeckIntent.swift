import Foundation
import AppIntents
import SwiftUI
internal import JourneyDeckRecorder

private func spokenAnswer(_ result: [String: Any]) -> String {
  guard result["status"] as? String == "answered", let text = result["text"] as? String,
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    return "Beep Boop. Can not compute."
  }
  return text
}

/// Compiled into the V3 app target by with-ask-journeydeck. App-target metadata
/// extraction discovers these types without relying on CocoaPods intent scanning.
@available(iOS 26.0, *)
struct AskJourneyDeckIntent: AppIntent {
  static let title: LocalizedStringResource = "Ask JourneyDeck"
  static let description = IntentDescription("Ask about your journeys, music, Memories, markers, or saved places. Reads the active profile's local history while the device is unlocked.")
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication
  static let openAppWhenRun = false

  @Parameter(title: "Question", requestValueDialog: "What would you like to know about your journeys?")
  var question: String

  static var parameterSummary: some ParameterSummary { Summary("Ask JourneyDeck \(\.$question)") }

  @MainActor
  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog & ShowsSnippetIntent {
    let result = await JourneyDeckAskService.shared.answer(question: question, siri: true)
    let text = spokenAnswer(result)
    let ticket = result["ticket"] as? String
    return .result(value: text, dialog: "\(text)", snippetIntent: AskJourneyDeckAnswerSnippet(ticket: ticket ?? ""))
  }
}

/// A static ShowsSnippetView cannot host working interactions. The iOS 26+
/// snippet intent revalidates live data each time Siri asks it to render.
/// Only an opaque ticket, never the question or archive text, is a parameter.
@available(iOS 26.0, *)
struct AskJourneyDeckAnswerSnippet: SnippetIntent {
  static let title: LocalizedStringResource = "JourneyDeck answer"
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication

  @Parameter(title: "Answer ticket") var ticket: String

  init() {}
  init(ticket: String) { self.ticket = ticket }

  @MainActor
  func perform() async throws -> some IntentResult & ShowsSnippetView {
    let result = await JourneyDeckAskService.shared.resolveForSiri(ticket: ticket)
    let text = spokenAnswer(result)
    return .result(view: AskJourneyDeckSnippet(text: text, ticket: result["ticket"] as? String))
  }
}

struct AskJourneyDeckSnippet: View {
  let text: String
  let ticket: String?
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Ask JourneyDeck").font(.headline)
      Text(text).privacySensitive()
      if let ticket, UUID(uuidString: ticket) != nil,
         let scheme = Bundle.main.object(forInfoDictionaryKey: "JourneyDeckAskURLScheme") as? String,
         let url = URL(string: "\(scheme)://ask-journeydeck?ticket=\(ticket)") {
        Link("Open supporting details", destination: url)
      }
    }.padding()
  }
}
