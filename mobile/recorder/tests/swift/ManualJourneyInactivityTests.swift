import Foundation

@main
struct ManualJourneyInactivityTests {
  static func fix(_ seconds: Double, speed: Double = 0, latitude: Double = 0, accuracy: Double = 5) -> ManualJourneyInactivity.Fix {
    .init(timestamp: 1_000_000 + seconds, latitude: latitude, longitude: 0, accuracy: accuracy, speed: speed)
  }
  static func observe(_ policy: inout ManualJourneyInactivity, _ sample: ManualJourneyInactivity.Fix) -> Bool {
    policy.observe(sample, now: sample.timestamp)
  }
  static func main() throws {
    var parked = ManualJourneyInactivity()
    for second in stride(from: 0.0, through: 585, by: 15) { precondition(!observe(&parked, fix(second))) }
    precondition(!observe(&parked, fix(599)))
    precondition(observe(&parked, fix(600)))

    for speed in [2.3, 5.0, 25.0] {
      var driving = ManualJourneyInactivity()
      for second in 0...1200 {
        precondition(!observe(&driving, fix(Double(second), speed: speed, latitude: Double(second) * speed / 111_195)))
      }
    }

    var walking = ManualJourneyInactivity()
    var stopped = false
    for second in stride(from: 0.0, through: 600, by: 15) {
      stopped = observe(&walking, fix(second, speed: 1.4, latitude: second * 1.4 / 111_195))
    }
    precondition(stopped)

    var gap = ManualJourneyInactivity()
    for second in stride(from: 0.0, through: 480, by: 15) { _ = observe(&gap, fix(second)) }
    for second in stride(from: 720.0, through: 1200, by: 15) { precondition(!observe(&gap, fix(second))) }
    precondition(!observe(&gap, fix(1215, accuracy: 500)))
    precondition(!observe(&gap, fix(1230)))

    var restored = ManualJourneyInactivity()
    for second in stride(from: 0.0, through: 300, by: 15) { _ = observe(&restored, fix(second)) }
    restored = try JSONDecoder().decode(ManualJourneyInactivity.self, from: JSONEncoder().encode(restored))
    precondition(!restored.observe(fix(100), now: fix(315).timestamp))
    precondition(!restored.observe(fix(9999), now: fix(315).timestamp))
    for second in stride(from: 315.0, through: 585, by: 15) { precondition(!observe(&restored, fix(second))) }
    precondition(observe(&restored, fix(600)))

    var jitter = ManualJourneyInactivity()
    for index in 0...40 {
      let result = observe(&jitter, fix(Double(index * 15), speed: 15, latitude: Double(index % 2) * 0.00002))
      precondition(result == (index == 40))
    }
    print("ManualJourneyInactivity: boundary, driving, walking, gaps, accuracy, recovery, stale/future and drift checks passed")
  }
}
