import CloudKit
import ExpoModulesCore

private let containerIdentifier = "iCloud.com.journeydeck.recorder"
private let allowedRecordTypes: Set<String> = ["Journey", "MusicEntry", "Collection", "Memory", "Photo", "PrivatePreference"]
private let maximumAssetBytes: UInt64 = 10 * 1_024 * 1_024

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

  func accountStatus() async throws -> String {
    accountStatusName(try await container.accountStatus())
  }

  func zoneID(profileScope: String) throws -> CKRecordZone.ID {
    let safe = String(profileScope.lowercased().filter { $0.isHexDigit }.prefix(48))
    guard safe.count >= 16 else { throw JourneyDeckCloudKitError.make(1, "The private sync profile scope is invalid.") }
    return CKRecordZone.ID(zoneName: "JourneyDeck-\(safe)", ownerName: CKCurrentUserDefaultName)
  }

  func ensureZone(profileScope: String) async throws -> CKRecordZone.ID {
    let status = try await container.accountStatus()
    guard status == .available else {
      throw JourneyDeckCloudKitError.make(2, "Private iCloud is unavailable: \(accountStatusName(status)).")
    }
    let id = try zoneID(profileScope: profileScope)
    let zones = try await database.recordZones(for: [id])
    if case .success? = zones[id] { return id }
    let result = try await database.modifyRecordZones(saving: [CKRecordZone(zoneID: id)], deleting: [])
    guard case .success? = result.saveResults[id] else {
      if case .failure(let error)? = result.saveResults[id] { throw error }
      throw JourneyDeckCloudKitError.make(3, "CloudKit did not create the private record zone.")
    }
    return id
  }

  func push(profileScope: String, inputs: [[String: Any]]) async throws -> [String: Any] {
    let zoneID = try await ensureZone(profileScope: profileScope)
    let parsed = try inputs.map { try parseInput($0, zoneID: zoneID) }
    if parsed.isEmpty { return ["savedRecordNames": [], "remoteRecords": [], "failedRecordNames": []] }

    let ids = parsed.map { $0.recordID }
    let fetched = try await database.records(for: ids, desiredKeys: nil)
    var recordsToSave: [CKRecord] = []
    var remoteWinners: [[String: Any]] = []
    var failedNames: [String] = []

    for item in parsed {
      let existing: CKRecord?
      if case .success(let record)? = fetched[item.recordID] {
        existing = record
      } else if case .failure(let error)? = fetched[item.recordID], !isUnknownItem(error) {
        failedNames.append(item.recordID.recordName)
        continue
      } else {
        existing = nil
      }

      if let existing {
        let remoteRevision = (existing["syncRevision"] as? NSNumber)?.intValue ?? 1
        let localRevision = (item.fields["syncRevision"] as? NSNumber)?.intValue ?? 1
        let remoteUpdated = existing["updatedAt"] as? String ?? ""
        let localUpdated = item.fields["updatedAt"] as? String ?? ""
        if remoteRevision > localRevision || (remoteRevision == localRevision && remoteUpdated >= localUpdated) {
          remoteWinners.append(dictionary(from: existing))
          continue
        }
      }

      let record = existing ?? CKRecord(recordType: item.recordType, recordID: item.recordID)
      try apply(fields: item.fields, to: record)
      if item.recordType == "Photo" {
        if let path = item.assetFilePath, !path.isEmpty {
          record["asset"] = CKAsset(fileURL: try validatedAssetURL(path))
        } else if item.fields["deletedAt"] is String {
          record["asset"] = nil
        }
      }
      recordsToSave.append(record)
    }

    if recordsToSave.isEmpty {
      return ["savedRecordNames": [], "remoteRecords": remoteWinners, "failedRecordNames": failedNames]
    }

    let result = try await database.modifyRecords(saving: recordsToSave, deleting: [], savePolicy: .ifServerRecordUnchanged, atomically: false)
    var savedNames: [String] = []
    for record in recordsToSave {
      if case .success? = result.saveResults[record.recordID] {
        savedNames.append(record.recordID.recordName)
      } else {
        failedNames.append(record.recordID.recordName)
      }
    }
    return ["savedRecordNames": savedNames, "remoteRecords": remoteWinners, "failedRecordNames": failedNames]
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
      let result = try await database.recordZoneChanges(inZoneWith: zoneID, since: token, desiredKeys: nil, resultsLimit: 200)
      for (_, modificationResult) in result.modificationResultsByID {
        if case .success(let modification) = modificationResult {
          records.append(dictionary(from: modification.record))
        }
      }
      deletedNames.append(contentsOf: result.deletions.map { $0.recordID.recordName })
      token = result.changeToken
      moreComing = result.moreComing
    }
    if let token { savePendingToken(token, zoneID: zoneID) }
    return ["records": records, "deletedRecordNames": deletedNames]
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
    return ParsedInput(recordID: CKRecord.ID(recordName: name, zoneID: zoneID), recordType: type, fields: fields, assetFilePath: input["assetFilePath"] as? String)
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

  private func validatedAssetURL(_ path: String) throws -> URL {
    let url = URL(string: path)?.isFileURL == true ? URL(string: path)! : URL(fileURLWithPath: path)
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw JourneyDeckCloudKitError.make(7, "A private photo file is missing from this device.")
    }
    let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(UInt64.init) ?? 0
    guard size > 0 && size <= maximumAssetBytes else {
      throw JourneyDeckCloudKitError.make(8, "A private photo file is empty or too large to sync.")
    }
    return url
  }

  private func persistentAssetPath(recordName: String, zoneName: String, asset: CKAsset) -> String? {
    guard let source = asset.fileURL else { return nil }
    do {
      let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        .appendingPathComponent("JourneyDeckPrivatePhotos", isDirectory: true)
      let safeZone = String((zoneName.isEmpty ? "unknown" : zoneName).map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" })
      let profileBase = base.appendingPathComponent(safeZone, isDirectory: true)
      try FileManager.default.createDirectory(at: profileBase, withIntermediateDirectories: true)
      let safeName = String(recordName.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? $0 : "_" })
      let destination = profileBase.appendingPathComponent(safeName).appendingPathExtension(source.pathExtension.isEmpty ? "jpg" : source.pathExtension)
      if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
      try FileManager.default.copyItem(at: source, to: destination)
      return destination.absoluteString
    } catch {
      return nil
    }
  }

  private func dictionary(from record: CKRecord) -> [String: Any] {
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
    if let asset = record["asset"] as? CKAsset,
       let path = persistentAssetPath(recordName: record.recordID.recordName, zoneName: record.recordID.zoneID.zoneName, asset: asset) {
      output["assetFilePath"] = path
    }
    return output
  }

  private func isUnknownItem(_ error: Error) -> Bool {
    (error as? CKError)?.code == .unknownItem
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

public final class JourneyDeckCloudKitModule: Module {
  private let transport = PrivateCloudKitTransport()

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckCloudKit")

    AsyncFunction("getAccountStatusAsync") { () async throws -> String in
      try await self.transport.accountStatus()
    }

    AsyncFunction("getCapabilitiesAsync") { () -> [String: Int] in
      ["privateContentVersion": 2]
    }

    AsyncFunction("ensurePrivateZoneAsync") { (profileScope: String) async throws -> [String: Bool] in
      _ = try await self.transport.ensureZone(profileScope: profileScope)
      return ["ready": true]
    }

    AsyncFunction("pushRecordsAsync") { (profileScope: String, records: [[String: Any]]) async throws -> [String: Any] in
      try await self.transport.push(profileScope: profileScope, inputs: records)
    }

    AsyncFunction("pullChangesAsync") { (profileScope: String) async throws -> [String: Any] in
      try await self.transport.pull(profileScope: profileScope)
    }

    AsyncFunction("commitChangeTokenAsync") { (profileScope: String) throws in
      try self.transport.commitPendingToken(profileScope: profileScope)
    }

    AsyncFunction("resetChangeTokenAsync") { (profileScope: String) throws in
      try self.transport.resetToken(profileScope: profileScope)
    }
  }
}
