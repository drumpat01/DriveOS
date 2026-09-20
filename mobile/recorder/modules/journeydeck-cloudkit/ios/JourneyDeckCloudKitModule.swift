import CloudKit
import CryptoKit
import ExpoModulesCore
import Foundation

private let containerIdentifier = Bundle.main.object(forInfoDictionaryKey: "JourneyDeckCloudKitContainer") as? String ?? "iCloud.com.journeydeck.recorder"
private let allowedRecordTypes: Set<String> = ["Journey", "RouteArchive", "JourneyEdit", "MusicEntry", "Collection", "Memory", "Photo", "PrivatePreference", "JourneyMarker", "MarkerPhoto"]
private let assetRecordTypes: Set<String> = ["Photo", "MarkerPhoto", "RouteArchive", "JourneyEdit"]
private let maximumPhotoAssetBytes: UInt64 = 10 * 1_024 * 1_024
private let maximumRouteAssetBytes: UInt64 = 20 * 1_024 * 1_024

private enum JourneyDeckCloudKitError {
  static func make(_ code: Int, _ message: String) -> NSError {
    NSError(domain: "JourneyDeckCloudKit", code: code, userInfo: [NSLocalizedDescriptionKey: message])
  }
}

private func accountStatusName(_ status: CKAccountStatus) -> String {
  switch status {
  case .available: return "available"
  case .noAccount: return "no_account"
  case .restricted: return "restricted"
  case .temporarilyUnavailable: return "temporarily_unavailable"
  case .couldNotDetermine: return "could_not_determine"
  @unknown default: return "could_not_determine"
  }
}

private func iso8601(_ date: Date) -> String {
  ISO8601DateFormatter().string(from: date)
}

private final class PrivateCloudKitTransport {
  private let container = CKContainer(identifier: containerIdentifier)
  private var database: CKDatabase { container.privateCloudDatabase }
  private var requests: CloudKitRequests { CloudKitRequests(database) }

  func accountStatus() async throws -> String {
    accountStatusName(try await CloudKitRequests.accountStatus(container))
  }

  func zoneID(profileScope: String) throws -> CKRecordZone.ID {
    let safe = String(profileScope.lowercased().filter { $0.isHexDigit }.prefix(48))
    guard safe.count >= 16 else { throw JourneyDeckCloudKitError.make(1, "The private sync profile scope is invalid.") }
    return CKRecordZone.ID(zoneName: "JourneyDeck-\(safe)", ownerName: CKCurrentUserDefaultName)
  }

  func ensureZone(profileScope: String) async throws -> CKRecordZone.ID {
    let status = try await CloudKitRequests.accountStatus(container)
    guard status == .available else {
      throw JourneyDeckCloudKitError.make(2, "Private iCloud is unavailable: \(accountStatusName(status)).")
    }
    let id = try zoneID(profileScope: profileScope)
    let zones = try await retrying { try await self.requests.zones([id]) }
    if case .success? = zones[id] { return id }
    if case .failure(let error)? = zones[id], !isUnknownItem(error), (error as? CKError)?.code != .zoneNotFound { throw error }
    let result = try await retrying { try await self.requests.modifyZones(saving: [CKRecordZone(zoneID: id)], deleting: []) }
    guard case .success? = result.saveResults[id] else {
      if case .failure(let error)? = result.saveResults[id] { throw error }
      throw JourneyDeckCloudKitError.make(3, "CloudKit did not create the private record zone.")
    }
    return id
  }

  func deleteZone(profileScope: String) async throws {
    let status = try await CloudKitRequests.accountStatus(container)
    guard status == .available else {
      throw JourneyDeckCloudKitError.make(2, "Private iCloud is unavailable: \(accountStatusName(status)).")
    }
    let id = try zoneID(profileScope: profileScope)
    let result = try await retrying { try await self.requests.modifyZones(saving: [], deleting: [id]) }
    guard let deletion = result.deleteResults[id] else { throw JourneyDeckCloudKitError.make(14, "CloudKit deletion was not confirmed.") }
    if case .failure(let error) = deletion, !isUnknownItem(error), (error as? CKError)?.code != .zoneNotFound { throw error }
    clearToken(zoneID: id)
    removePersistedAssets(zoneID: id)
  }

  func push(profileScope: String, inputs: [[String: Any]]) async throws -> [String: Any] {
    let zoneID = try await ensureZone(profileScope: profileScope)
    let parsed = try inputs.map { try parseInput($0, zoneID: zoneID) }
    if parsed.isEmpty { return ["savedRecordNames": [], "remoteRecords": [], "failedRecordNames": [], "failedRecords": []] }

    let ids = parsed.map { $0.recordID }
    let fetched = try await retrying { try await self.requests.records(ids) }
    var recordsToSave: [CKRecord] = []
    var remoteWinners: [[String: Any]] = []
    var failedNames: [String] = []
    var failedRecords: [[String: Any]] = []

    for item in parsed {
      let existing: CKRecord?
      if case .success(let record)? = fetched[item.recordID] {
        existing = record
      } else if case .failure(let error)? = fetched[item.recordID], !isUnknownItem(error) {
        failedNames.append(item.recordID.recordName)
        failedRecords.append(failureDictionary(recordName: item.recordID.recordName, error: error))
        continue
      } else {
        existing = nil
      }

      if let existing {
        let remoteRevision = (existing["syncRevision"] as? NSNumber)?.intValue ?? 1
        let localRevision = (item.fields["syncRevision"] as? NSNumber)?.intValue ?? 1
        let remoteUpdated = existing["updatedAt"] as? String ?? ""
        let localUpdated = item.fields["updatedAt"] as? String ?? ""
        let remoteDeleted = existing["deletedAt"] is String
        let localDeleted = item.fields["deletedAt"] is String
        let remoteWins = remoteRevision > localRevision || (remoteRevision == localRevision && (
          remoteDeleted != localDeleted ? remoteDeleted : remoteUpdated >= localUpdated
        ))
        if remoteWins {
          remoteWinners.append(try dictionary(from: existing))
          continue
        }
      }

      let record = existing ?? CKRecord(recordType: item.recordType, recordID: item.recordID)
      try apply(fields: item.fields, to: record)
      if assetRecordTypes.contains(item.recordType) {
        if let path = item.assetFilePath, !path.isEmpty {
          record["asset"] = CKAsset(fileURL: try validatedAssetURL(path, recordType: item.recordType))
        } else if item.fields["deletedAt"] is String {
          record["asset"] = nil
        } else {
          throw JourneyDeckCloudKitError.make(9, "A private asset record is missing its local file.")
        }
      }
      recordsToSave.append(record)
    }

    if recordsToSave.isEmpty {
      return [
        "savedRecordNames": [], "remoteRecords": deduplicate(remoteWinners),
        "failedRecordNames": Array(Set(failedNames)).sorted(), "failedRecords": deduplicateFailures(failedRecords)
      ]
    }

    let result = try await retrying {
      try await self.requests.save(recordsToSave)
    }
    var savedNames: [String] = []
    for record in recordsToSave {
      if case .success? = result[record.recordID] {
        savedNames.append(record.recordID.recordName)
      } else if case .failure(let error)? = result[record.recordID] {
        if let serverRecord = serverRecordChangedWinner(error) {
          remoteWinners.append(try dictionary(from: serverRecord))
          continue
        }
        failedNames.append(record.recordID.recordName)
        failedRecords.append(failureDictionary(recordName: record.recordID.recordName, error: error))
      }
    }
    return [
      "savedRecordNames": savedNames,
      "remoteRecords": deduplicate(remoteWinners),
      "failedRecordNames": Array(Set(failedNames)).sorted(),
      "failedRecords": deduplicateFailures(failedRecords)
    ]
  }

  func pull(profileScope: String) async throws -> [String: Any] {
    let zoneID = try await ensureZone(profileScope: profileScope)
    do {
      return try await pull(zoneID: zoneID, startingWith: loadToken(zoneID: zoneID))
    } catch let error as CKError where error.code == .changeTokenExpired {
      clearToken(zoneID: zoneID)
      return try await pull(zoneID: zoneID, startingWith: nil)
    }
  }

  func resetToken(profileScope: String) throws {
    clearToken(zoneID: try zoneID(profileScope: profileScope))
  }

  func commitPendingToken(profileScope: String) throws {
    let id = try zoneID(profileScope: profileScope)
    guard let token = loadPendingToken(zoneID: id) else { return }
    saveToken(token, zoneID: id)
    UserDefaults.standard.removeObject(forKey: pendingTokenKey(zoneID: id))
  }

  private func pull(zoneID: CKRecordZone.ID, startingWith initialToken: CKServerChangeToken?) async throws -> [String: Any] {
    var token = initialToken
    var records: [[String: Any]] = []
    var deletedNames: [String] = []
    var moreComing = true
    while moreComing {
      let result = try await retrying {
        try await self.requests.changes(zone: zoneID, token: token)
      }
      guard let nextToken = result.changeToken else {
        throw JourneyDeckCloudKitError.make(15, "CloudKit returned an incomplete change page; the previous cursor was retained.")
      }
      if result.moreComing, let previous = token, nextToken.isEqual(previous) {
        throw JourneyDeckCloudKitError.make(15, "CloudKit change cursor did not advance. Retry sync shortly.")
      }
      for (_, modificationResult) in result.records {
        switch modificationResult {
        case .success(let modification):
          records.append(try dictionary(from: modification))
        case .failure(let error):
          // The page token covers failed records too. Advancing it would make
          // an undownloaded record disappear from future incremental pulls.
          // Leave the committed cursor untouched and retry the page next time.
          throw error
        }
      }
      deletedNames.append(contentsOf: result.deletions.map { $0.recordName })
      token = nextToken
      moreComing = result.moreComing
    }
    if let token { savePendingToken(token, zoneID: zoneID) }
    return ["records": records, "deletedRecordNames": deletedNames, "changeTokenStaged": token != nil]
  }

  private struct ParsedInput {
    let recordID: CKRecord.ID
    let recordType: String
    let fields: [String: Any]
    let assetFilePath: String?
  }

  private func parseInput(_ input: [String: Any], zoneID: CKRecordZone.ID) throws -> ParsedInput {
    guard let name = input["recordName"] as? String, !name.isEmpty, name.count <= 255,
          let type = input["recordType"] as? String, allowedRecordTypes.contains(type),
          let fields = input["fields"] as? [String: Any] else {
      throw JourneyDeckCloudKitError.make(4, "A CloudKit record payload is invalid.")
    }
    let assetFilePath = input["assetFilePath"] as? String
    if assetFilePath != nil && !assetRecordTypes.contains(type) {
      throw JourneyDeckCloudKitError.make(4, "Only approved private record types may carry assets.")
    }
    return ParsedInput(recordID: CKRecord.ID(recordName: name, zoneID: zoneID), recordType: type, fields: fields, assetFilePath: assetFilePath)
  }

  private func apply(fields: [String: Any], to record: CKRecord) throws {
    for (key, value) in fields {
      guard key.range(of: "^[A-Za-z][A-Za-z0-9_]{0,63}$", options: .regularExpression) != nil else {
        throw JourneyDeckCloudKitError.make(5, "A CloudKit field name is invalid.")
      }
      if value is NSNull { record[key] = nil; continue }
      if let value = value as? String { record[key] = value as CKRecordValue; continue }
      if let value = value as? NSNumber { record[key] = value as CKRecordValue; continue }
      throw JourneyDeckCloudKitError.make(6, "CloudKit field \(key) has an unsupported value type.")
    }
  }

  private func validatedAssetURL(_ path: String, recordType: String) throws -> URL {
    let url = URL(string: path)?.isFileURL == true ? URL(string: path)! : URL(fileURLWithPath: path)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw JourneyDeckCloudKitError.make(7, "A private photo file is missing from this device.")
    }
    let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(UInt64.init) ?? 0
    let maximumBytes = ["Photo", "MarkerPhoto"].contains(recordType) ? maximumPhotoAssetBytes : maximumRouteAssetBytes
    guard size > 0 && size <= maximumBytes else {
      throw JourneyDeckCloudKitError.make(8, "A private asset file is empty or too large to sync.")
    }
    return url
  }

  private func persistentAssetPath(recordName: String, recordType: String, zoneName: String, asset: CKAsset) throws -> String {
    guard assetRecordTypes.contains(recordType), let source = asset.fileURL else {
      throw JourneyDeckCloudKitError.make(10, "A downloaded private asset is invalid.")
    }
    let size = (try? source.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(UInt64.init) ?? 0
    let maximumBytes = ["Photo", "MarkerPhoto"].contains(recordType) ? maximumPhotoAssetBytes : maximumRouteAssetBytes
    guard size > 0 && size <= maximumBytes else {
      throw JourneyDeckCloudKitError.make(11, "A downloaded private asset is empty or too large.")
    }
    let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("JourneyDeckPrivateAssets", isDirectory: true)
    let safeZone = String((zoneName.isEmpty ? "unknown" : zoneName).map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" })
    let safeType = String(recordType.map { $0.isLetter || $0.isNumber ? $0 : "_" })
    let profileBase = base.appendingPathComponent(safeZone, isDirectory: true).appendingPathComponent(safeType, isDirectory: true)
    try FileManager.default.createDirectory(at: profileBase, withIntermediateDirectories: true)
    let safeName = String(recordName.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" })
    let photoExtensions: Set<String> = ["heic", "heif", "jpg", "jpeg", "png", "webp"]
    let sourceExtension = source.pathExtension.lowercased()
    let fileExtension = ["Photo", "MarkerPhoto"].contains(recordType) ? (photoExtensions.contains(sourceExtension) ? sourceExtension : "jpg") : "json"
    // Downloading precedes JavaScript revision/conflict checks. A stable
    // record-name path could overwrite the current winning photo with an older
    // remote version even when SQLite later rejects that record. Keep each
    // distinct payload immutable; cursor replay reuses the same content path.
    let digest = SHA256.hash(data: try Data(contentsOf: source, options: .mappedIfSafe))
      .map { String(format: "%02x", $0) }.joined()
    let destination = profileBase.appendingPathComponent("\(safeName)-\(digest)").appendingPathExtension(fileExtension)
    if FileManager.default.fileExists(atPath: destination.path) { return destination.absoluteString }
    let temporary = profileBase.appendingPathComponent(".\(safeName)-\(UUID().uuidString)").appendingPathExtension(fileExtension)
    defer { try? FileManager.default.removeItem(at: temporary) }
    try FileManager.default.copyItem(at: source, to: temporary)
    try FileManager.default.moveItem(at: temporary, to: destination)
    return destination.absoluteString
  }

  private func removePersistedAssets(zoneID: CKRecordZone.ID) {
    do {
      let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        .appendingPathComponent("JourneyDeckPrivateAssets", isDirectory: true)
      let safeZone = String(zoneID.zoneName.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" })
      let profileBase = base.appendingPathComponent(safeZone, isDirectory: true)
      if FileManager.default.fileExists(atPath: profileBase.path) { try FileManager.default.removeItem(at: profileBase) }
    } catch {
      // The CloudKit zone is already gone. Local cache cleanup is best effort.
    }
  }

  private func dictionary(from record: CKRecord) throws -> [String: Any] {
    guard allowedRecordTypes.contains(record.recordType) else {
      throw JourneyDeckCloudKitError.make(12, "Private iCloud returned an unsupported record type.")
    }
    var fields: [String: Any] = [:]
    for key in record.allKeys() {
      if let value = record[key] as? String { fields[key] = value }
      else if let value = record[key] as? NSNumber { fields[key] = value }
    }
    var output: [String: Any] = [
      "recordName": record.recordID.recordName,
      "recordType": record.recordType,
      "fields": fields,
      "modificationDate": iso8601(record.modificationDate ?? Date())
    ]
    if let asset = record["asset"] as? CKAsset {
      guard assetRecordTypes.contains(record.recordType) else {
        throw JourneyDeckCloudKitError.make(12, "An unsupported private record carried an asset.")
      }
      output["assetFilePath"] = try persistentAssetPath(recordName: record.recordID.recordName, recordType: record.recordType, zoneName: record.recordID.zoneID.zoneName, asset: asset)
    } else if assetRecordTypes.contains(record.recordType) && !(record["deletedAt"] is String) {
      throw JourneyDeckCloudKitError.make(10, "A downloaded private asset record is missing its file.")
    }
    return output
  }

  private func isUnknownItem(_ error: Error) -> Bool {
    (error as? CKError)?.code == .unknownItem
  }

  private func serverRecordChangedWinner(_ error: Error) -> CKRecord? {
    guard let cloudError = error as? CKError, cloudError.code == .serverRecordChanged else { return nil }
    return cloudError.userInfo[CKRecordChangedErrorServerRecordKey] as? CKRecord
  }

  private func retrying<T>(_ operation: @escaping () async throws -> T) async throws -> T {
    var attempt = 0
    while true {
      do { return try await operation() }
      catch {
        guard attempt < 2, isRetryable(error) else { throw error }
        let serverDelay = retryAfterSeconds(error) ?? 0
        guard serverDelay.isFinite, serverDelay <= 30 else { throw error }
        let exponential = min(8, pow(2, Double(attempt)))
        let delay = max(serverDelay, exponential)
        attempt += 1
        try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
      }
    }
  }

  private func isRetryable(_ error: Error) -> Bool {
    guard let code = (error as? CKError)?.code else { return false }
    return [.networkFailure, .networkUnavailable, .requestRateLimited, .serviceUnavailable,
            .zoneBusy, .accountTemporarilyUnavailable, .notAuthenticated].contains(code)
  }

  private func retryAfterSeconds(_ error: Error) -> Double? {
    guard let cloudError = error as? CKError else { return nil }
    return (cloudError.userInfo[CKErrorRetryAfterKey] as? NSNumber)?.doubleValue
  }

  private func failureCode(_ error: Error) -> String {
    guard let code = (error as? CKError)?.code else { return "cloudkit_unknown" }
    switch code {
    case .networkFailure: return "network_failure"
    case .networkUnavailable: return "network_unavailable"
    case .requestRateLimited: return "rate_limited"
    case .serviceUnavailable: return "service_unavailable"
    case .zoneBusy: return "zone_busy"
    case .accountTemporarilyUnavailable: return "account_temporarily_unavailable"
    case .notAuthenticated: return "not_authenticated"
    case .serverRecordChanged: return "server_record_changed"
    case .quotaExceeded: return "quota_exceeded"
    case .permissionFailure: return "permission_failure"
    case .limitExceeded: return "limit_exceeded"
    case .assetFileNotFound: return "asset_missing"
    case .assetFileModified: return "asset_modified"
    default: return "cloudkit_\(code.rawValue)"
    }
  }

  private func failureDictionary(recordName: String, error: Error) -> [String: Any] {
    [
      "recordName": recordName,
      "code": failureCode(error),
      "retryable": isRetryable(error),
      "retryAfterSeconds": retryAfterSeconds(error) ?? NSNull()
    ]
  }

  private func deduplicateFailures(_ failures: [[String: Any]]) -> [[String: Any]] {
    var names = Set<String>()
    return failures.filter { failure in
      guard let name = failure["recordName"] as? String else { return false }
      return names.insert(name).inserted
    }
  }

  private func deduplicate(_ records: [[String: Any]]) -> [[String: Any]] {
    var names = Set<String>()
    return records.filter { record in
      guard let name = record["recordName"] as? String else { return false }
      return names.insert(name).inserted
    }
  }

  private func tokenKey(zoneID: CKRecordZone.ID) -> String {
    "journeydeck.cloudkit.token.\(zoneID.zoneName)"
  }

  private func pendingTokenKey(zoneID: CKRecordZone.ID) -> String {
    "journeydeck.cloudkit.pending-token.\(zoneID.zoneName)"
  }

  private func loadToken(zoneID: CKRecordZone.ID) -> CKServerChangeToken? {
    guard let data = UserDefaults.standard.data(forKey: tokenKey(zoneID: zoneID)) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
  }

  private func saveToken(_ token: CKServerChangeToken, zoneID: CKRecordZone.ID) {
    if let data = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) {
      UserDefaults.standard.set(data, forKey: tokenKey(zoneID: zoneID))
    }
  }

  private func loadPendingToken(zoneID: CKRecordZone.ID) -> CKServerChangeToken? {
    guard let data = UserDefaults.standard.data(forKey: pendingTokenKey(zoneID: zoneID)) else { return nil }
    return try? NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
  }

  private func savePendingToken(_ token: CKServerChangeToken, zoneID: CKRecordZone.ID) {
    if let data = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) {
      UserDefaults.standard.set(data, forKey: pendingTokenKey(zoneID: zoneID))
    }
  }

  private func clearToken(zoneID: CKRecordZone.ID) {
    UserDefaults.standard.removeObject(forKey: tokenKey(zoneID: zoneID))
    UserDefaults.standard.removeObject(forKey: pendingTokenKey(zoneID: zoneID))
  }
}

private enum CloudTransportGate {
  private static let lock = NSLock()
  private static var active = false
  static func acquire() throws {
    lock.lock()
    defer { lock.unlock() }
    guard !active else { throw JourneyDeckCloudKitError.make(16, "Private iCloud is recovering an earlier request. Retry shortly.") }
    active = true
  }
  static func release() {
    lock.lock()
    active = false
    lock.unlock()
  }
}

public final class JourneyDeckCloudKitModule: Module {
  private let transport = PrivateCloudKitTransport()

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckCloudKit")

    AsyncFunction("getAccountStatusAsync") { () async throws -> String in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      return try await self.transport.accountStatus()
    }

    AsyncFunction("getCapabilitiesAsync") { () -> [String: Any] in
      ["privateContentVersion": 5, "transportVersion": 7, "retryMetadata": true]
    }

    AsyncFunction("ensurePrivateZoneAsync") { (profileScope: String) async throws -> [String: Bool] in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      _ = try await self.transport.ensureZone(profileScope: profileScope)
      return ["ready": true]
    }

    AsyncFunction("deletePrivateZoneAsync") { (profileScope: String) async throws -> [String: Bool] in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      try await self.transport.deleteZone(profileScope: profileScope)
      return ["deleted": true]
    }

    AsyncFunction("pushRecordsAsync") { (profileScope: String, records: [[String: Any]]) async throws -> [String: Any] in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      return try await self.transport.push(profileScope: profileScope, inputs: records)
    }

    AsyncFunction("pullChangesAsync") { (profileScope: String) async throws -> [String: Any] in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      return try await self.transport.pull(profileScope: profileScope)
    }

    AsyncFunction("commitChangeTokenAsync") { (profileScope: String) throws in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      try self.transport.commitPendingToken(profileScope: profileScope)
    }

    AsyncFunction("resetChangeTokenAsync") { (profileScope: String) throws in
      try CloudTransportGate.acquire()
      defer { CloudTransportGate.release() }
      try self.transport.resetToken(profileScope: profileScope)
    }
  }
}
