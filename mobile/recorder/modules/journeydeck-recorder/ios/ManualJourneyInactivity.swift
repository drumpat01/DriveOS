import Foundation

// Kept free of CoreLocation so the exact policy can run in command-line tests.
struct ManualJourneyInactivity: Codable {
  struct Fix: Codable {
    let timestamp: Double
    let latitude: Double
    let longitude: Double
    let accuracy: Double
    let speed: Double
  }

  static let timeout: Double = 10 * 60
  static let maximumDuration: Double = 24 * 60 * 60
  private(set) var stationarySince: Double?
  private var previous: Fix?
  private var lastAcceptedAt: Double?
  init() {}

  mutating func observe(_ fix: Fix, now: Double) -> Bool {
    guard fix.timestamp.isFinite, fix.timestamp <= now, now - fix.timestamp <= 60,
          fix.timestamp > (lastAcceptedAt ?? -.infinity) else { return false }
    guard fix.accuracy.isFinite, fix.accuracy >= 0, fix.accuracy <= 50,
          fix.latitude.isFinite, abs(fix.latitude) <= 90,
          fix.longitude.isFinite, abs(fix.longitude) <= 180 else {
      stationarySince = nil
      previous = nil
      lastAcceptedAt = fix.timestamp
      return false
    }
    // Missing GPS is unknown, never proof that a vehicle has stopped.
    if let lastAcceptedAt, fix.timestamp - lastAcceptedAt > 120 {
      stationarySince = nil
      previous = nil
    }
    lastAcceptedAt = fix.timestamp
    guard let anchor = previous else {
      previous = fix
      stationarySince = fix.speed >= 0 && fix.speed <= 2.2 ? fix.timestamp : nil
      return false
    }
    let elapsed = fix.timestamp - anchor.timestamp
    // Compare over a useful baseline rather than subtracting GPS uncertainty
    // from tiny one-second movements, which can misclassify an ongoing drive.
    guard elapsed >= 15 else { return false }
    previous = fix
    let radians = Double.pi / 180
    let a = pow(sin((fix.latitude - anchor.latitude) * radians / 2), 2)
      + cos(anchor.latitude * radians) * cos(fix.latitude * radians)
      * pow(sin((fix.longitude - anchor.longitude) * radians / 2), 2)
    let distance = 6_371_000 * 2 * asin(sqrt(min(1, max(0, a))))
    let lowerSpeed = max(0, distance - max(fix.accuracy, anchor.accuracy)) / elapsed
    let upperSpeed = (distance + max(fix.accuracy, anchor.accuracy)) / elapsed
    if lowerSpeed > 2.2 {
      stationarySince = nil
    } else if upperSpeed <= 2.2 {
      stationarySince = stationarySince ?? anchor.timestamp
    } else {
      // Ambiguous displacement must not accumulate a false parked interval.
      stationarySince = nil
    }
    return stationarySince.map { fix.timestamp - $0 >= Self.timeout } ?? false
  }
}
