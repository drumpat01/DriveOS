import ExpoModulesCore
import UIKit

public final class JourneyDeckRecorderAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    JourneyDeckNativeRecorder.shared.bootstrap()
    JourneyDeckWatchBridge.shared.activate()
    return true
  }
}
