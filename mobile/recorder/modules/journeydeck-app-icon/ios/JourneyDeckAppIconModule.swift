import ExpoModulesCore
import UIKit

public final class JourneyDeckAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JourneyDeckAppIcon")

    AsyncFunction("getStatusAsync") { () async -> [String: Any?] in
      await self.status()
    }

    AsyncFunction("setIconAsync") { (iconName: String?) async throws -> [String: Any?] in
      try await self.setIcon(iconName)
    }
  }

  @MainActor
  private func status() -> [String: Any?] {
    [
      "nativeModuleAvailable": true,
      "supported": UIApplication.shared.supportsAlternateIcons,
      "iconName": UIApplication.shared.alternateIconName,
    ]
  }

  @MainActor
  private func setIcon(_ iconName: String?) async throws -> [String: Any?] {
    guard UIApplication.shared.supportsAlternateIcons else {
      throw NSError(
        domain: "JourneyDeckAppIcon",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "This device does not support alternate app icons."]
      )
    }
    if let iconName, !["JourneyDeckWarmIvory", "JourneyDeckRosewater", "JourneyDeckGrandTouring"].contains(iconName) {
      throw NSError(domain: "JourneyDeckAppIcon", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Unknown JourneyDeck app icon."])
    }
    if UIApplication.shared.alternateIconName == iconName { return status() }
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      UIApplication.shared.setAlternateIconName(iconName) { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: ())
        }
      }
    }
    return status()
  }
}
