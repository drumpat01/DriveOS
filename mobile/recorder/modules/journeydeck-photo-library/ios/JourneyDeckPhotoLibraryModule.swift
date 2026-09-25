import ExpoModulesCore
import Photos
import UIKit

public final class JourneyDeckPhotoLibraryModule: Module {
  @MainActor private var activeScanID: String?
  @MainActor private var scanExpiry = Date.distantPast
  @MainActor private var allowedAssets = Set<String>()
  @MainActor private var cancelledScans = Set<String>()
  @MainActor private var pendingImages: [UUID: (PHImageRequestID, (UIImage?) -> Void)] = [:]
  @MainActor private var processingImages = 0

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckPhotoLibrary")
    AsyncFunction("getStatusAsync") { () async -> [String: Any] in await self.status() }
    AsyncFunction("adoptScanAsync") { (scanID: String, windows: [[String: Double]], assetIDs: [String]) async throws -> [String] in
      try await self.adoptScan(scanID, windows: windows, assetIDs: assetIDs)
    }
    AsyncFunction("previewAsync") { (scanID: String, assetID: String) async throws -> [String: Any] in
      try await self.preview(scanID, assetID: assetID)
    }
    AsyncFunction("exportAsync") { (scanID: String, assetID: String) async throws -> [String: Any] in
      try await self.export(scanID, assetID: assetID)
    }
    AsyncFunction("cancelAsync") { (scanID: String) async in await self.cancel(scanID) }
  }

  private func failure(_ message: String) -> NSError {
    NSError(domain: "JourneyDeckPhotoLibrary", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }

  @MainActor private func canRead() -> Bool {
    let permission = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    return permission == .authorized || permission == .limited
  }

  @MainActor private func status() -> [String: Any] {
    let permission: String
    switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
    case .authorized: permission = "full"
    case .limited: permission = "limited"
    case .denied: permission = "denied"
    case .restricted: permission = "restricted"
    default: permission = "undetermined"
    }
    return ["permission": permission]
  }

  @MainActor private func adoptScan(_ scanID: String, windows: [[String: Double]], assetIDs: [String]) throws -> [String] {
    guard canRead(), UIApplication.shared.applicationState == .active else {
      throw failure("Allow access to selected photos before looking for matches.")
    }
    guard !cancelledScans.contains(scanID), !scanID.isEmpty, scanID.count <= 100,
      !windows.isEmpty, windows.count <= 30, assetIDs.count <= 400,
      Set(assetIDs).count == assetIDs.count else { throw failure("This photo review has ended. Start a fresh search.") }
    var ranges: [ClosedRange<Date>] = []
    for window in windows {
      guard let start = window["startMs"], let end = window["endMs"], start.isFinite, end.isFinite,
        end >= start, end - start <= 31 * 86400_000 else { throw failure("Choose journeys with valid dates for photo matching.") }
      ranges.append(Date(timeIntervalSince1970: start / 1000)...Date(timeIntervalSince1970: end / 1000))
    }
    if let previous = activeScanID { cancel(previous) }
    activeScanID = scanID
    scanExpiry = Date().addingTimeInterval(20 * 60)
    let options = PHFetchOptions()
    options.includeHiddenAssets = false
    options.includeAllBurstAssets = false
    let fetched = PHAsset.fetchAssets(withLocalIdentifiers: assetIDs, options: options)
    var approved: [String] = []
    fetched.enumerateObjects { asset, _, _ in
      guard asset.mediaType == .image, !asset.isHidden,
        !asset.mediaSubtypes.contains(.photoScreenshot), let createdAt = asset.creationDate,
        ranges.contains(where: { $0.contains(createdAt) }) else { return }
      approved.append(asset.localIdentifier)
      self.allowedAssets.insert(asset.localIdentifier)
    }
    return approved
  }

  @MainActor private func selectedAsset(_ scanID: String, assetID: String) throws -> PHAsset {
    guard activeScanID == scanID, Date() < scanExpiry, !cancelledScans.contains(scanID), allowedAssets.contains(assetID), canRead(),
      UIApplication.shared.applicationState == .active else { throw failure("This photo review has ended. Search again to refresh photo access.") }
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [assetID], options: nil).firstObject,
      !asset.isHidden, asset.mediaType == .image else { throw failure("This photo is no longer available for this review.") }
    return asset
  }

  @MainActor private func cancel(_ scanID: String) {
    cancelledScans.insert(scanID)
    // UUIDs are never reused. Bound the tombstone set in long app sessions.
    if cancelledScans.count > 256 { cancelledScans = [scanID] }
    guard activeScanID == scanID else { return }
    activeScanID = nil
    allowedAssets.removeAll()
    let pending = pendingImages
    pendingImages.removeAll()
    for (_, (requestID, finish)) in pending {
      PHImageManager.default().cancelImageRequest(requestID)
      finish(nil)
    }
  }

  @MainActor private func finishImage(_ token: UUID, image: UIImage?) {
    guard let (_, finish) = pendingImages.removeValue(forKey: token) else { return }
    finish(image)
  }

  @MainActor private func image(_ asset: PHAsset, size: CGFloat) async -> UIImage? {
    guard pendingImages.count < 24 else { return nil }
    let token = UUID()
    return await withCheckedContinuation { continuation in
      let options = PHImageRequestOptions()
      options.isNetworkAccessAllowed = false
      options.deliveryMode = .highQualityFormat
      options.resizeMode = .exact
      options.version = .current
      let requestID = PHImageManager.default().requestImage(for: asset, targetSize: CGSize(width: size, height: size),
        contentMode: .aspectFit, options: options) { image, info in
        if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
        DispatchQueue.main.async { self.finishImage(token, image: image) }
      }
      pendingImages[token] = (requestID, { image in continuation.resume(returning: image) })
      DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
        guard self.pendingImages[token] != nil else { return }
        PHImageManager.default().cancelImageRequest(requestID)
        self.finishImage(token, image: nil)
      }
    }
  }

  @MainActor private func jpeg(_ image: UIImage, maxBytes: Int) -> Data? {
    // Rendering creates a new pixel-only JPEG: no source EXIF/GPS/filename leaves PhotoKit.
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let ratio = min(1, 1280 / max(image.size.width, image.size.height))
    let size = CGSize(width: max(1, image.size.width * ratio), height: max(1, image.size.height * ratio))
    let clean = UIGraphicsImageRenderer(size: size, format: format).image { context in
      UIColor.white.setFill(); context.fill(CGRect(origin: .zero, size: size))
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    for quality in [CGFloat(0.85), 0.65, 0.45, 0.25] {
      if let data = clean.jpegData(compressionQuality: quality), data.count <= maxBytes { return data }
    }
    return nil
  }

  @MainActor private func preview(_ scanID: String, assetID: String) async throws -> [String: Any] {
    let asset = try selectedAsset(scanID, assetID: assetID)
    // Bound decoded images throughout encoding, not just PhotoKit fetching.
    guard processingImages < 12 else { throw failure("Photos are still being prepared. Retry this preview in a moment.") }
    processingImages += 1
    defer { processingImages -= 1 }
    guard let image = await image(asset, size: 640) else {
      return ["status": "unavailable"]
    }
    _ = try selectedAsset(scanID, assetID: assetID)
    guard let data = jpeg(image, maxBytes: 240_000) else { return ["status": "unavailable"] }
    _ = try selectedAsset(scanID, assetID: assetID)
    return ["status": "ready", "dataUri": "data:image/jpeg;base64," + data.base64EncodedString()]
  }

  @MainActor private func export(_ scanID: String, assetID: String) async throws -> [String: Any] {
    let asset = try selectedAsset(scanID, assetID: assetID)
    guard processingImages < 12 else { throw failure("Photos are still being prepared. Retry the remaining selection in a moment.") }
    processingImages += 1
    defer { processingImages -= 1 }
    guard let image = await image(asset, size: 1280) else { throw failure("Download this photo in Photos, then return and search again.") }
    _ = try selectedAsset(scanID, assetID: assetID)
    guard let data = jpeg(image, maxBytes: 1_572_864) else { throw failure("This photo could not be prepared within the private library size limit.") }
    _ = try selectedAsset(scanID, assetID: assetID)
    return ["fileName": "Journey photo.jpg", "contentType": "image/jpeg", "dataBase64": data.base64EncodedString()]
  }
}
