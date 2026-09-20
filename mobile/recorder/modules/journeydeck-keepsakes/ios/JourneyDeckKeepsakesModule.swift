import ExpoModulesCore
import Minted
import SceneKit
import SwiftUI
import UIKit

public final class JourneyDeckKeepsakesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JourneyDeckKeepsakes")
    Constant("assetCatalogVersion") { 3 }
    View(JourneyDeckKeepsakeView.self) {
      Prop("achievementId") { (view: JourneyDeckKeepsakeView, value: String) in view.achievementId = value }
      Prop("name") { (view: JourneyDeckKeepsakeView, value: String) in view.medallionName = value }
      Prop("artworkUri") { (view: JourneyDeckKeepsakeView, value: String) in view.artworkUri = value }
      OnViewDidUpdateProps { (view: JourneyDeckKeepsakeView) in view.applyChanges() }
    }
  }
}

private enum JourneyDeckMintCatalog {
  private static var cache: [String: ArtworkCoin] = [:]
  private static var cacheOrder: [String] = []

  static func coin(artworkUri: String) -> ArtworkCoin? {
    guard let url = URL(string: artworkUri), url.isFileURL else { return nil }
    let key = url.standardizedFileURL.path
    if let cached = cache[key] { return cached }
    guard let image = UIImage(contentsOfFile: key),
          let coin = try? ArtworkCoin(image: image) else { return nil }
    cache[key] = coin
    cacheOrder.append(key)
    if cacheOrder.count > 12 {
      cache.removeValue(forKey: cacheOrder.removeFirst())
    }
    return coin
  }
}

final class JourneyDeckKeepsakeView: ExpoView {
  var achievementId = "first-track"
  var medallionName = "The First Track"
  var artworkUri = ""
  private var renderedKey: String?
  private var hostingController: UIHostingController<AnyView>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = true
    isAccessibilityElement = true
    accessibilityHint = "Drag left or right to rotate the medallion"
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
  }

  func applyChanges() {
    accessibilityLabel = "\(medallionName) medallion"
    let key = artworkUri
    guard key != renderedKey else { return }
    hostingController?.view.removeFromSuperview()
    hostingController = nil
    renderedKey = key
    guard let coin = JourneyDeckMintCatalog.coin(artworkUri: artworkUri) else {
      accessibilityValue = "Artwork unavailable"
      return
    }
    accessibilityValue = nil
    let controller = UIHostingController(rootView: AnyView(JourneyDeckSpinningCoinView(coin: coin, idlePeriod: 13)))
    controller.view.backgroundColor = .clear
    controller.view.isOpaque = false
    controller.view.frame = bounds
    addSubview(controller.view)
    hostingController = controller
  }
}

private struct JourneyDeckSpinningCoinView: UIViewRepresentable {
  let coin: ArtworkCoin
  let idlePeriod: Double
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  func makeUIView(context: Context) -> SCNView {
    let view = SCNView()
    view.backgroundColor = .clear
    view.antialiasingMode = .multisampling4X
    view.rendersContinuously = false
    let gold = UIColor(red: 0.84, green: 0.66, blue: 0.31, alpha: 1)
    view.scene = ArtworkCoinScene.makeScene(coin: coin, gold: gold)
    let node = view.scene?.rootNode.childNode(withName: ArtworkCoinScene.coinNodeName, recursively: true)
    node?.eulerAngles.y = 0
    context.coordinator.coin = node
    context.coordinator.idlePeriod = idlePeriod
    if !reduceMotion {
      node?.runAction(.repeatForever(.rotateBy(x: 0, y: 2 * .pi, z: 0, duration: idlePeriod)), forKey: "idle")
    }
    view.addGestureRecognizer(UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.pan(_:))))
    return view
  }

  func updateUIView(_ view: SCNView, context: Context) {}
  func makeCoordinator() -> Coordinator { Coordinator() }

  final class Coordinator: NSObject {
    var coin: SCNNode?
    var idlePeriod: Double = 13
    private var idleWasRunning = false

    @objc func pan(_ gesture: UIPanGestureRecognizer) {
      guard let coin, let view = gesture.view else { return }
      switch gesture.state {
      case .began:
        idleWasRunning = coin.action(forKey: "idle") != nil
        coin.removeAction(forKey: "idle")
        coin.removeAction(forKey: "momentum")
      case .changed:
        coin.eulerAngles.y += Float(gesture.translation(in: view).x) * 0.012
        gesture.setTranslation(.zero, in: view)
      case .ended, .cancelled:
        let spin = SCNAction.rotateBy(x: 0, y: gesture.velocity(in: view).x * 0.0022, z: 0, duration: 1.4)
        spin.timingMode = .easeOut
        let period = idlePeriod
        coin.runAction(spin, forKey: "momentum") { [weak self, weak coin] in
          guard let self, self.idleWasRunning, let coin else { return }
          coin.runAction(.repeatForever(.rotateBy(x: 0, y: 2 * .pi, z: 0, duration: period)), forKey: "idle")
        }
      default: break
      }
    }
  }
}
