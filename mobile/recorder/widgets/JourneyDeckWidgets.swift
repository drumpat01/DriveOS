import SwiftUI
import WidgetKit

/// One-tap Start: opens JourneyDeck with journeydeck-recorder://start-journey,
/// which starts recording as soon as the app's recorder is ready.
private let startURL = URL(string: "journeydeck-recorder://start-journey")!

// Grand Touring, the default theme.
private let navy = Color(red: 8 / 255, green: 24 / 255, blue: 50 / 255)
private let champagne = Color(red: 212 / 255, green: 177 / 255, blue: 90 / 255)
private let ivory = Color(red: 246 / 255, green: 240 / 255, blue: 226 / 255)

/// The latest drive, written by the app into the shared App Group after each trip.
struct LastDrive: Decodable {
  let miles: Double
  let minutes: Double
  let startedAt: String
}

struct StartJourneyEntry: TimelineEntry {
  let date: Date
  let lastDrive: LastDrive?
}

private func readLastDrive() -> LastDrive? {
  guard let group = Bundle.main.object(forInfoDictionaryKey: "JourneyDeckAppGroup") as? String,
        let json = UserDefaults(suiteName: group)?.string(forKey: "startWidgetLastDrive"),
        let data = json.data(using: .utf8) else { return nil }
  return try? JSONDecoder().decode(LastDrive.self, from: data)
}

struct StartJourneyProvider: TimelineProvider {
  func placeholder(in context: Context) -> StartJourneyEntry {
    StartJourneyEntry(date: .now, lastDrive: LastDrive(miles: 12.4, minutes: 28, startedAt: ISO8601DateFormatter().string(from: .now)))
  }
  func getSnapshot(in context: Context, completion: @escaping (StartJourneyEntry) -> Void) {
    completion(StartJourneyEntry(date: .now, lastDrive: readLastDrive() ?? placeholder(in: context).lastDrive))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<StartJourneyEntry>) -> Void) {
    // The app reloads this timeline after each drive; refresh daily so "Tuesday" ages into a date.
    let tomorrow = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400))
    completion(Timeline(entries: [StartJourneyEntry(date: .now, lastDrive: readLastDrive())], policy: .after(tomorrow)))
  }
}

private func driveDay(_ iso: String) -> String {
  let parser = ISO8601DateFormatter()
  parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "Recently" }
  if Calendar.current.isDateInToday(date) { return "Today" }
  if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
  let days = Calendar.current.dateComponents([.day], from: date, to: .now).day ?? 0
  return days < 7 ? date.formatted(.dateTime.weekday(.wide)) : date.formatted(.dateTime.month(.abbreviated).day())
}

private func milesText(_ miles: Double) -> String {
  miles < 10 ? String(format: "%.1f mi", miles) : "\(Int(miles.rounded())) mi"
}

struct StartJourneyView: View {
  @Environment(\.widgetFamily) private var family
  var entry: StartJourneyEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "car.fill").font(.system(size: 20, weight: .semibold))
      }
      .widgetURL(startURL)
      .accessibilityLabel("Start a JourneyDeck journey")
      .containerBackground(for: .widget) { Color.clear }
    default:
      VStack(alignment: .leading, spacing: 0) {
        if let drive = entry.lastDrive {
          Text("LAST DRIVE").font(.system(size: 9, weight: .bold)).tracking(1).foregroundStyle(ivory.opacity(0.8))
          Text(milesText(drive.miles)).font(.system(size: 24, weight: .semibold, design: .serif)).foregroundStyle(ivory)
            .lineLimit(1).minimumScaleFactor(0.7)
          Text("\(driveDay(drive.startedAt)) · \(Int(drive.minutes.rounded())) min").font(.system(size: 11)).foregroundStyle(ivory.opacity(0.85))
            .lineLimit(1)
        } else {
          Text("JOURNEYDECK").font(.system(size: 9, weight: .bold)).tracking(1).foregroundStyle(ivory.opacity(0.8))
          Text("Your first drive awaits").font(.system(size: 20, weight: .semibold, design: .serif)).foregroundStyle(ivory)
            .lineLimit(2).minimumScaleFactor(0.7)
        }
        Spacer(minLength: 6)
        HStack(spacing: 6) {
          Circle().fill(navy).frame(width: 8, height: 8)
          Text("Start Journey").font(.system(size: 14, weight: .bold)).foregroundStyle(navy).lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 36)
        .background(Capsule().fill(champagne))
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .widgetURL(startURL)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(entry.lastDrive.map { "Last drive \(milesText($0.miles)), \(driveDay($0.startedAt)). Start a JourneyDeck journey" } ?? "Start a JourneyDeck journey")
      .containerBackground(for: .widget) {
        ZStack {
          Image("RoadPhoto").resizable().scaledToFill()
          LinearGradient(stops: [
            .init(color: navy.opacity(0.55), location: 0),
            .init(color: navy.opacity(0.1), location: 0.35),
            .init(color: navy.opacity(0.93), location: 1),
          ], startPoint: .top, endPoint: .bottom)
        }
      }
    }
  }
}

struct StartJourneyWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "StartJourney", provider: StartJourneyProvider()) { entry in
      StartJourneyView(entry: entry)
    }
    .configurationDisplayName("Start a Journey")
    .description("Your last drive, and one tap to start the next.")
    .supportedFamilies([.systemSmall, .accessoryCircular])
  }
}

@main
struct JourneyDeckWidgets: WidgetBundle {
  var body: some Widget { StartJourneyWidget() }
}
