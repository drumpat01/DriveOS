import AVFoundation
import ExpoModulesCore
import MediaPlayer
import MusicKit
import ShazamKit

private let minimumRecognitionMilliseconds = 3_000
private let maximumRecognitionMilliseconds = 15_000

private enum JourneyDeckMusicError {
  static func make(_ code: Int, _ message: String) -> NSError {
    NSError(
      domain: "JourneyDeckMusic",
      code: code,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}

private func musicAuthorizationName(_ status: MusicAuthorization.Status) -> String {
  switch status {
  case .notDetermined:
    return "not_determined"
  case .denied:
    return "denied"
  case .restricted:
    return "restricted"
  case .authorized:
    return "authorized"
  @unknown default:
    return "unknown"
  }
}

private func microphonePermissionName(_ status: AVAudioSession.RecordPermission) -> String {
  switch status {
  case .undetermined:
    return "not_determined"
  case .denied:
    return "denied"
  case .granted:
    return "authorized"
  @unknown default:
    return "unknown"
  }
}

private func iso8601(_ date: Date) -> String {
  ISO8601DateFormatter().string(from: date)
}

private func playbackStateName(_ state: MPMusicPlaybackState) -> String {
  switch state {
  case .stopped:
    return "stopped"
  case .playing:
    return "playing"
  case .paused:
    return "paused"
  case .interrupted:
    return "interrupted"
  case .seekingForward:
    return "seeking_forward"
  case .seekingBackward:
    return "seeking_backward"
  @unknown default:
    return "unknown"
  }
}

/// Captures only transient microphone buffers. ShazamKit receives signatures generated
/// in memory; JourneyDeck never writes or exports raw audio.
private final class BoundedShazamRecognizer: NSObject, SHSessionDelegate {
  private var audioEngine: AVAudioEngine?
  private var mixerNode: AVAudioMixerNode?
  private var shazamSession: SHSession?
  private var timeoutWorkItem: DispatchWorkItem?
  private var continuation: CheckedContinuation<[String: Any], Error>?

  func recognize(milliseconds: Int) async throws -> [String: Any] {
    try await withCheckedThrowingContinuation { continuation in
      DispatchQueue.main.async {
        guard self.continuation == nil else {
          continuation.resume(throwing: JourneyDeckMusicError.make(20, "Music recognition is already running."))
          return
        }

        self.continuation = continuation
        self.ensureMicrophonePermissionAndStart(milliseconds: milliseconds)
      }
    }
  }

  private func ensureMicrophonePermissionAndStart(milliseconds: Int) {
    let audioSession = AVAudioSession.sharedInstance()

    switch audioSession.recordPermission {
    case .granted:
      start(milliseconds: milliseconds)
    case .denied:
      finish(.failure(JourneyDeckMusicError.make(21, "Microphone access is required for automatic music recognition.")))
    case .undetermined:
      audioSession.requestRecordPermission { [weak self] granted in
        DispatchQueue.main.async {
          guard let self else { return }
          if granted {
            self.start(milliseconds: milliseconds)
          } else {
            self.finish(.failure(JourneyDeckMusicError.make(21, "Microphone access is required for automatic music recognition.")))
          }
        }
      }
    @unknown default:
      finish(.failure(JourneyDeckMusicError.make(22, "Microphone permission status is unavailable.")))
    }
  }

  private func start(milliseconds: Int) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(
        .playAndRecord,
        mode: .measurement,
        options: [.mixWithOthers, .allowBluetoothA2DP]
      )
      try audioSession.setActive(true)

      let engine = AVAudioEngine()
      let mixer = AVAudioMixerNode()
      let session = SHSession()
      session.delegate = self

      let inputFormat = engine.inputNode.inputFormat(forBus: 0)
      guard inputFormat.sampleRate > 0,
            let outputFormat = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1) else {
        throw JourneyDeckMusicError.make(23, "The microphone audio format is unavailable.")
      }

      engine.attach(mixer)
      engine.connect(engine.inputNode, to: mixer, format: inputFormat)
      engine.connect(mixer, to: engine.mainMixerNode, format: outputFormat)
      engine.mainMixerNode.outputVolume = 0

      mixer.installTap(onBus: 0, bufferSize: 8_192, format: outputFormat) { [weak session] buffer, audioTime in
        session?.matchStreamingBuffer(buffer, at: audioTime)
      }

      audioEngine = engine
      mixerNode = mixer
      shazamSession = session

      engine.prepare()
      try engine.start()

      let workItem = DispatchWorkItem { [weak self] in
        self?.finish(.success([
          "status": "no_match",
          "recognizedAt": iso8601(Date())
        ]))
      }
      timeoutWorkItem = workItem
      DispatchQueue.main.asyncAfter(
        deadline: .now() + .milliseconds(milliseconds),
        execute: workItem
      )
    } catch {
      finish(.failure(error))
    }
  }

  func session(_ session: SHSession, didFind match: SHMatch) {
    guard let item = match.mediaItems.first else { return }

    var result: [String: Any] = [
      "status": "matched",
      "recognizedAt": iso8601(Date()),
      "genres": item.genres
    ]
    if let value = item.title { result["title"] = value }
    if let value = item.artist { result["artist"] = value }
    if let value = item.isrc { result["isrc"] = value }
    if let value = item.shazamID { result["shazamId"] = value }
    if let value = item.appleMusicID { result["appleMusicId"] = value }
    if let value = item.artworkURL { result["artworkUrl"] = value.absoluteString }
    if let value = item.appleMusicURL { result["appleMusicUrl"] = value.absoluteString }
    if let value = item.webURL { result["shazamUrl"] = value.absoluteString }

    DispatchQueue.main.async { [weak self] in
      self?.finish(.success(result))
    }
  }

  func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
    guard let error else { return }
    DispatchQueue.main.async { [weak self] in
      self?.finish(.failure(JourneyDeckMusicError.make(24, "ShazamKit could not complete recognition: \(error.localizedDescription)")))
    }
  }

  private func finish(_ result: Result<[String: Any], Error>) {
    guard let continuation else { return }

    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil

    if let mixerNode {
      mixerNode.removeTap(onBus: 0)
    }
    audioEngine?.stop()
    audioEngine?.reset()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

    self.continuation = nil
    audioEngine = nil
    mixerNode = nil
    shazamSession = nil
    continuation.resume(with: result)
  }
}

public final class JourneyDeckMusicModule: Module {
  private let recognizer = BoundedShazamRecognizer()

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckMusic")

    AsyncFunction("getCapabilityStatusAsync") {
      [
        "nativeModuleAvailable": true,
        "appleMusicAvailable": true,
        "appleMusicAuthorizationStatus": musicAuthorizationName(MusicAuthorization.currentStatus),
        "shazamKitAvailable": true,
        "microphonePermissionStatus": microphonePermissionName(AVAudioSession.sharedInstance().recordPermission),
        "minimumRecognitionMilliseconds": minimumRecognitionMilliseconds,
        "maximumRecognitionMilliseconds": maximumRecognitionMilliseconds,
        "requiresAppleMusicAppService": true,
        "requiresShazamKitAppService": true
      ] as [String: Any]
    }

    AsyncFunction("requestAppleMusicAuthorizationAsync") { () async -> String in
      musicAuthorizationName(await MusicAuthorization.request())
    }

    AsyncFunction("getAppleMusicRecentSongsAsync") { (requestedLimit: Int) async throws -> [[String: Any]] in
      guard MusicAuthorization.currentStatus == .authorized else {
        throw JourneyDeckMusicError.make(10, "Apple Music access has not been authorized.")
      }

      var request = MusicRecentlyPlayedRequest<Song>()
      request.limit = min(max(requestedLimit, 1), 50)
      let response = try await request.response()
      let retrievedAt = iso8601(Date())

      return response.items.map { song in
        var item: [String: Any] = [
          "id": song.id.rawValue,
          "title": song.title,
          "artist": song.artistName,
          "genres": song.genreNames,
          "retrievedAt": retrievedAt
        ]
        if let value = song.albumTitle { item["album"] = value }
        if let value = song.duration { item["durationSeconds"] = value }
        if let value = song.lastPlayedDate { item["lastPlayedAt"] = iso8601(value) }
        if let value = song.isrc { item["isrc"] = value }
        if let value = song.url { item["appleMusicUrl"] = value.absoluteString }
        // JourneyDeck renders covers as compact cards. A 256 px source keeps the
        // persistent Expo disk cache small while remaining sharp on iPhone.
        if let value = song.artwork?.url(width: 256, height: 256) {
          item["artworkUrl"] = value.absoluteString
        }
        return item
      }
    }

    AsyncFunction("getCurrentAppleMusicTrackAsync") { () -> [String: Any] in
      let sampledAtDate = Date()
      let player = MPMusicPlayerController.systemMusicPlayer
      let playbackState = player.playbackState
      let isPlaying = playbackState == .playing

      guard MusicAuthorization.currentStatus == .authorized else {
        return [
          "available": false,
          "reason": "not_authorized",
          "sampledAt": iso8601(sampledAtDate),
          "playbackState": playbackStateName(playbackState),
          "isPlaying": isPlaying
        ]
      }

      guard let song = player.nowPlayingItem else {
        return [
          "available": false,
          "reason": "nothing_playing",
          "sampledAt": iso8601(sampledAtDate),
          "playbackState": playbackStateName(playbackState),
          "isPlaying": isPlaying
        ]
      }

      let rawPlaybackTime = player.currentPlaybackTime
      let playbackTime = rawPlaybackTime.isFinite && rawPlaybackTime >= 0 ? rawPlaybackTime : 0
      var item: [String: Any] = [
        "available": true,
        "sampledAt": iso8601(sampledAtDate),
        "estimatedStartedAt": iso8601(sampledAtDate.addingTimeInterval(-playbackTime)),
        "playbackState": playbackStateName(playbackState),
        "isPlaying": isPlaying,
        "persistentId": String(song.persistentID),
        "durationSeconds": song.playbackDuration,
        "playbackTimeSeconds": playbackTime
      ]
      if let value = song.title { item["title"] = value }
      if let value = song.artist { item["artist"] = value }
      if let value = song.albumTitle { item["album"] = value }
      if !song.playbackStoreID.isEmpty { item["appleMusicId"] = song.playbackStoreID }
      if let value = song.lastPlayedDate { item["lastPlayedAt"] = iso8601(value) }
      return item
    }.runOnQueue(.main)

    AsyncFunction("getMicrophonePermissionStatusAsync") {
      microphonePermissionName(AVAudioSession.sharedInstance().recordPermission)
    }

    AsyncFunction("requestMicrophonePermissionAsync") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        promise.resolve(granted ? "authorized" : "denied")
      }
    }

    AsyncFunction("recognizeMusicAsync") { (requestedMilliseconds: Int) async throws -> [String: Any] in
      let milliseconds = min(
        max(requestedMilliseconds, minimumRecognitionMilliseconds),
        maximumRecognitionMilliseconds
      )
      return try await recognizer.recognize(milliseconds: milliseconds)
    }
  }
}
