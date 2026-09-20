import ExpoModulesCore
import StoreKit

private let journeyDeckMembershipProductIDs: Set<String> = [
  "com.journeydeck.recorder.pro.monthly",
  "com.journeydeck.recorder.pro.annual",
]

private enum JourneyDeckMembershipError {
  static func make(_ code: Int, _ message: String) -> NSError {
    NSError(
      domain: "JourneyDeckMembership",
      code: code,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }
}

private func iso8601(_ date: Date?) -> String? {
  guard let date else { return nil }
  return ISO8601DateFormatter().string(from: date)
}

private func environmentName(_ environment: AppStore.Environment) -> String? {
  switch environment {
  case .production:
    return "production"
  case .sandbox:
    return "sandbox"
  case .xcode:
    return "xcode"
  default:
    return nil
  }
}

private func subscriptionPeriodUnit(_ unit: Product.SubscriptionPeriod.Unit) -> String {
  switch unit {
  case .day:
    return "day"
  case .week:
    return "week"
  case .month:
    return "month"
  case .year:
    return "year"
  @unknown default:
    return "month"
  }
}

public final class JourneyDeckMembershipModule: Module {
  private var transactionUpdatesTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("JourneyDeckMembership")
    Events("onMembershipChanged")

    OnCreate {
      self.startTransactionListener()
    }

    OnDestroy {
      self.transactionUpdatesTask?.cancel()
      self.transactionUpdatesTask = nil
    }

    AsyncFunction("getMembershipStatusAsync") { () async -> [String: Any?] in
      await self.membershipStatus()
    }

    AsyncFunction("getProductsAsync") { (requestedProductIDs: [String]) async throws -> [[String: Any?]] in
      let safeProductIDs = requestedProductIDs.filter { journeyDeckMembershipProductIDs.contains($0) }
      guard !safeProductIDs.isEmpty else { return [] }
      let products = try await Product.products(for: safeProductIDs)
      return products.sorted { left, right in
        let leftPeriod = left.subscription?.subscriptionPeriod.value ?? Int.max
        let rightPeriod = right.subscription?.subscriptionPeriod.value ?? Int.max
        return leftPeriod < rightPeriod
      }.map { product in
        let period = product.subscription?.subscriptionPeriod
        return [
          "id": product.id,
          "displayName": product.displayName,
          "description": product.description,
          "displayPrice": product.displayPrice,
          "periodUnit": period.map { subscriptionPeriodUnit($0.unit) },
          "periodValue": period?.value,
          "isFamilyShareable": product.isFamilyShareable,
        ]
      }
    }

    AsyncFunction("purchaseAsync") { (productID: String) async throws -> [String: Any?] in
      guard journeyDeckMembershipProductIDs.contains(productID) else {
        throw JourneyDeckMembershipError.make(10, "That JourneyDeck membership is not recognized.")
      }
      guard let product = try await Product.products(for: [productID]).first else {
        throw JourneyDeckMembershipError.make(11, "This membership is not available from the App Store yet.")
      }

      let result = try await product.purchase()
      switch result {
      case .success(let verificationResult):
        guard case .verified(let transaction) = verificationResult else {
          throw JourneyDeckMembershipError.make(12, "The App Store purchase could not be verified.")
        }
        guard journeyDeckMembershipProductIDs.contains(transaction.productID) else {
          throw JourneyDeckMembershipError.make(13, "The verified purchase does not unlock JourneyDeck membership.")
        }
        await transaction.finish()
        let status = await self.membershipStatus()
        self.sendEvent("onMembershipChanged", status)
        return ["outcome": "purchased", "status": status]
      case .pending:
        return ["outcome": "pending", "status": await self.membershipStatus()]
      case .userCancelled:
        return ["outcome": "cancelled", "status": await self.membershipStatus()]
      @unknown default:
        return ["outcome": "cancelled", "status": await self.membershipStatus()]
      }
    }

    AsyncFunction("restorePurchasesAsync") { () async throws -> [String: Any?] in
      try await AppStore.sync()
      let status = await self.membershipStatus()
      self.sendEvent("onMembershipChanged", status)
      return status
    }
  }

  private func startTransactionListener() {
    guard transactionUpdatesTask == nil else { return }
    transactionUpdatesTask = Task { [weak self] in
      for await verificationResult in StoreKit.Transaction.updates {
        guard !Task.isCancelled else { return }
        guard case .verified(let transaction) = verificationResult,
              journeyDeckMembershipProductIDs.contains(transaction.productID) else { continue }
        await transaction.finish()
        guard let self else { return }
        let status = await self.membershipStatus()
        self.sendEvent("onMembershipChanged", status)
      }
    }
  }

  private func membershipStatus() async -> [String: Any?] {
    var newestTransaction: StoreKit.Transaction?
    for await verificationResult in StoreKit.Transaction.currentEntitlements {
      guard case .verified(let transaction) = verificationResult,
            journeyDeckMembershipProductIDs.contains(transaction.productID),
            transaction.revocationDate == nil else { continue }
      if newestTransaction == nil || transaction.purchaseDate > newestTransaction!.purchaseDate {
        newestTransaction = transaction
      }
    }

    guard let transaction = newestTransaction else {
      return [
        "nativeModuleAvailable": true,
        "tier": "free",
        "activeProductId": nil,
        "expirationDate": nil,
        "environment": nil,
      ]
    }

    return [
      "nativeModuleAvailable": true,
      "tier": "paid",
      "activeProductId": transaction.productID,
      "expirationDate": iso8601(transaction.expirationDate),
      "environment": environmentName(transaction.environment),
    ]
  }
}
