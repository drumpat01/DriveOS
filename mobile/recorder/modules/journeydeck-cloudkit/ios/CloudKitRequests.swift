import CloudKit
import Foundation

// One-shot completion also fences late callbacks after cancellation. A timeout
// is an ambiguous remote outcome: callers retain queued data and reconcile on
// the next pull; they must not acknowledge an upload from an expired response.
private final class CloudReply<T> {
  private let lock = NSLock()
  private var continuation: CheckedContinuation<T, Error>?
  init(_ continuation: CheckedContinuation<T, Error>) { self.continuation = continuation }
  func finish(_ result: Result<T, Error>) {
    lock.lock()
    let target = continuation
    continuation = nil
    lock.unlock()
    target?.resume(with: result)
  }
}

final class CloudKitRequests {
  private let database: CKDatabase
  init(_ database: CKDatabase) { self.database = database }
  private static var timeout: NSError {
    NSError(domain: "JourneyDeckCloudKit", code: 13,
            userInfo: [NSLocalizedDescriptionKey: "Private iCloud request timed out. Local data remains queued; retry sync to reconcile."])
  }

  static func accountStatus(_ container: CKContainer) async throws -> CKAccountStatus {
    try await withCheckedThrowingContinuation { continuation in
      let reply = CloudReply<CKAccountStatus>(continuation)
      let deadline = DispatchWorkItem { reply.finish(.failure(timeout)) }
      DispatchQueue.global().asyncAfter(deadline: .now() + 30, execute: deadline)
      container.accountStatus { status, error in
        deadline.cancel()
        if let error { reply.finish(.failure(error)) }
        else { reply.finish(.success(status)) }
      }
    }
  }

  private func run<T>(_ operation: CKDatabaseOperation,
                      install: (@escaping (Result<T, Error>) -> Void) -> Void) async throws -> T {
    try await withCheckedThrowingContinuation { continuation in
      let reply = CloudReply<T>(continuation)
      operation.configuration.timeoutIntervalForRequest = 30
      operation.configuration.timeoutIntervalForResource = 90
      let deadline = DispatchWorkItem { [weak operation] in
        // Do not wait for CloudKit to deliver its cancellation callback.
        reply.finish(.failure(Self.timeout))
        operation?.cancel()
      }
      install { result in deadline.cancel(); reply.finish(result) }
      DispatchQueue.global().asyncAfter(deadline: .now() + 95, execute: deadline)
      database.add(operation)
    }
  }

  func zones(_ ids: [CKRecordZone.ID]) async throws -> [CKRecordZone.ID: Result<CKRecordZone, Error>] {
    let operation = CKFetchRecordZonesOperation(recordZoneIDs: ids)
    var values: [CKRecordZone.ID: Result<CKRecordZone, Error>] = [:]
    operation.perRecordZoneResultBlock = { id, result in values[id] = result }
    return try await run(operation) { done in
      operation.fetchRecordZonesResultBlock = { result in
        // Per-item failures are handled by the caller; transport failures aren't.
        if case .failure(let error) = result, values.isEmpty { done(.failure(error)) }
        else { done(.success(values)) }
      }
    }
  }

  typealias ZoneResults = (saveResults: [CKRecordZone.ID: Result<CKRecordZone, Error>], deleteResults: [CKRecordZone.ID: Result<Void, Error>])
  func modifyZones(saving: [CKRecordZone], deleting: [CKRecordZone.ID]) async throws -> ZoneResults {
    let operation = CKModifyRecordZonesOperation(recordZonesToSave: saving, recordZoneIDsToDelete: deleting)
    var saved: [CKRecordZone.ID: Result<CKRecordZone, Error>] = [:]
    var deleted: [CKRecordZone.ID: Result<Void, Error>] = [:]
    operation.perRecordZoneSaveBlock = { id, result in saved[id] = result }
    operation.perRecordZoneDeleteBlock = { id, result in deleted[id] = result }
    return try await run(operation) { done in
      operation.modifyRecordZonesResultBlock = { result in
        if case .failure(let error) = result, saved.count + deleted.count < saving.count + deleting.count { done(.failure(error)) }
        else { done(.success((saved, deleted))) }
      }
    }
  }

  func records(_ ids: [CKRecord.ID]) async throws -> [CKRecord.ID: Result<CKRecord, Error>] {
    let operation = CKFetchRecordsOperation(recordIDs: ids)
    var values: [CKRecord.ID: Result<CKRecord, Error>] = [:]
    operation.perRecordResultBlock = { id, result in values[id] = result }
    return try await run(operation) { done in
      operation.fetchRecordsResultBlock = { result in
        if case .failure(let error) = result, values.count < ids.count { done(.failure(error)) }
        else { done(.success(values)) }
      }
    }
  }

  func save(_ records: [CKRecord]) async throws -> [CKRecord.ID: Result<CKRecord, Error>] {
    let operation = CKModifyRecordsOperation(recordsToSave: records, recordIDsToDelete: [])
    operation.savePolicy = .ifServerRecordUnchanged
    operation.isAtomic = false
    var values: [CKRecord.ID: Result<CKRecord, Error>] = [:]
    operation.perRecordSaveBlock = { id, result in values[id] = result }
    return try await run(operation) { done in
      operation.modifyRecordsResultBlock = { result in
        if case .failure(let error) = result, values.count < records.count { done(.failure(error)) }
        else { done(.success(values)) }
      }
    }
  }

  struct Page {
    var records: [CKRecord.ID: Result<CKRecord, Error>] = [:]
    var deletions: [CKRecord.ID] = []
    var changeToken: CKServerChangeToken?
    var moreComing = false
  }
  func changes(zone: CKRecordZone.ID, token: CKServerChangeToken?) async throws -> Page {
    let config = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
    config.previousServerChangeToken = token
    config.resultsLimit = 200
    let operation = CKFetchRecordZoneChangesOperation(recordZoneIDs: [zone], configurationsByRecordZoneID: [zone: config])
    operation.fetchAllChanges = false
    var page = Page()
    var zoneError: Error?
    operation.recordWasChangedBlock = { id, result in page.records[id] = result }
    operation.recordWithIDWasDeletedBlock = { id, _ in page.deletions.append(id) }
    operation.recordZoneFetchResultBlock = { _, result in
      switch result {
      case .success(let value): page.changeToken = value.serverChangeToken; page.moreComing = value.moreComing
      case .failure(let error): zoneError = error
      }
    }
    return try await run(operation) { done in
      operation.fetchRecordZoneChangesResultBlock = { result in
        if let zoneError { done(.failure(zoneError)) }
        else { done(result.map { page }) }
      }
    }
  }
}
