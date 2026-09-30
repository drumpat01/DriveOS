import Foundation
import Security
import AppIntents
import StoreKit
import SwiftUI
internal import JourneyDeckRecorder

private func spokenAnswer(_ result: [String: Any]) -> String {
  guard result["status"] as? String == "answered", let text = result["text"] as? String,
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
    return "Beep Boop. Can not compute."
  }
  return text
}

private let plusRequiredAnswer = "Ask JourneyDeck is part of JourneyDeck Plus. Open JourneyDeck to upgrade."

/// Must match the product IDs in JourneyDeckMembershipModule.swift.
private let journeyDeckPlusProductIDs: Set<String> = [
  "com.journeydeck.recorder.pro.monthly",
  "com.journeydeck.recorder.pro.weekly",
  "com.journeydeck.recorder.pro.annual",
]

/// Must match PLUS_TRIAL_* in src/plus-trial.ts (expo-secure-store's Keychain layout).
private func plusTrialActive(now: Date = Date()) -> Bool {
  let key = Data("journeydeck.plus-trial.started-at".utf8)
  for service in ["journeydeck.plus-trial:no-auth", "journeydeck.plus-trial"] {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
      kSecAttrGeneric as String: key, kSecAttrAccount as String: key,
      kSecMatchLimit as String: kSecMatchLimitOne, kSecReturnData as String: true,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data,
          let text = String(data: data, encoding: .utf8), let started = Double(text) else { continue }
    let startedAt = Date(timeIntervalSince1970: started / 1000)
    let days = Bundle.main.object(forInfoDictionaryKey: "JourneyDeckPlusTrialDays") as? Int ?? 7
    return now >= startedAt && now < startedAt.addingTimeInterval(Double(days) * 86_400)
  }
  return false
}

/// Siri runs without the JavaScript app, so it checks StoreKit directly. The
/// TestFlight Plus unlock is a build-time Info.plist flag, never a user setting.
private func hasJourneyDeckPlus() async -> Bool {
  if Bundle.main.object(forInfoDictionaryKey: "JourneyDeckPlusUnlocked") as? Bool == true { return true }
  if Bundle.main.object(forInfoDictionaryKey: "JourneyDeckPlusTrialFromFirstLaunch") as? Bool != false,
     plusTrialActive() { return true }
  for await result in StoreKit.Transaction.currentEntitlements {
    if case .verified(let transaction) = result, journeyDeckPlusProductIDs.contains(transaction.productID),
       transaction.revocationDate == nil { return true }
  }
  return false
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
    guard await hasJourneyDeckPlus() else {
      return .result(value: plusRequiredAnswer, dialog: "\(plusRequiredAnswer)", snippetIntent: AskJourneyDeckAnswerSnippet(ticket: ""))
    }
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
    guard await hasJourneyDeckPlus() else { return .result(view: AskJourneyDeckSnippet(text: plusRequiredAnswer, ticket: nil)) }
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
