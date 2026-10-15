import AuthenticationServices
import Foundation
import SafariServices
import UIKit

@objc(QasimhaCheckout)
class QasimhaCheckout: NSObject, SFSafariViewControllerDelegate, ASWebAuthenticationPresentationContextProviding {
  private var resolver: RCTPromiseResolveBlock?
  private var safari: SFSafariViewController?
  private var session: ASWebAuthenticationSession?
  private var closing = false

  @objc(open:options:resolver:rejecter:)
  func open(
    _ paymentUrl: String,
    options: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    guard let url = URL(string: paymentUrl), url.scheme?.lowercased() == "https", let host = url.host, !host.isEmpty else {
      rejecter("INVALID_URL", "paymentUrl must be an https URL", nil)
      return
    }
    DispatchQueue.main.async {
      if self.resolver != nil {
        rejecter("IN_PROGRESS", "A checkout is already presented", nil)
        return
      }
      let presentation = options["presentation"] as? String ?? "systemBrowser"
      if presentation == "webAuthenticationSession" {
        self.openSession(url, options: options, resolver: resolver, rejecter: rejecter)
      } else {
        self.openSafari(url, resolver: resolver, rejecter: rejecter)
      }
    }
  }

  @objc(close:rejecter:)
  func close(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if let session = self.session {
        self.closing = true
        session.cancel()
        self.finish(dismissed: false, url: nil)
      } else if let safari = self.safari {
        self.closing = true
        safari.dismiss(animated: true) {
          self.finish(dismissed: false, url: nil)
        }
      }
      resolver(nil)
    }
  }

  private func openSafari(_ url: URL, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let host = QasimhaCheckout.topViewController() else {
      rejecter("NO_VIEW_CONTROLLER", "No view controller to present the checkout from", nil)
      return
    }
    let configuration = SFSafariViewController.Configuration()
    configuration.entersReaderIfAvailable = false
    let controller = SFSafariViewController(url: url, configuration: configuration)
    controller.delegate = self
    controller.dismissButtonStyle = .cancel
    self.safari = controller
    self.resolver = resolver
    self.closing = false
    host.present(controller, animated: true)
  }

  private func openSession(_ url: URL, options: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let completion: ASWebAuthenticationSession.CompletionHandler = { callbackURL, _ in
      DispatchQueue.main.async {
        if let callbackURL = callbackURL {
          self.finish(dismissed: false, url: callbackURL.absoluteString)
        } else {
          self.finish(dismissed: !self.closing, url: nil)
        }
      }
    }
    let session: ASWebAuthenticationSession
    if let scheme = options["callbackScheme"] as? String, !scheme.isEmpty {
      session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme, completionHandler: completion)
    } else if let host = options["callbackHost"] as? String, !host.isEmpty {
      if #available(iOS 17.4, *) {
        let path = options["callbackPath"] as? String ?? "/"
        session = ASWebAuthenticationSession(url: url, callback: .https(host: host, path: path), completionHandler: completion)
      } else {
        rejecter("UNSUPPORTED", "https return URLs with webAuthenticationSession need iOS 17.4; use a custom scheme or systemBrowser", nil)
        return
      }
    } else {
      rejecter("INVALID_URL", "webAuthenticationSession needs a callback scheme or host", nil)
      return
    }
    session.presentationContextProvider = self
    session.prefersEphemeralWebBrowserSession = true
    self.session = session
    self.resolver = resolver
    self.closing = false
    if !session.start() {
      self.session = nil
      self.resolver = nil
      rejecter("PRESENTATION_FAILED", "The web authentication session could not start", nil)
    }
  }

  private func finish(dismissed: Bool, url: String?) {
    guard let resolver = self.resolver else { return }
    self.resolver = nil
    self.safari = nil
    self.session = nil
    self.closing = false
    var payload: [String: Any] = ["dismissed": dismissed]
    if let url = url {
      payload["url"] = url
    }
    resolver(payload)
  }

  func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
    finish(dismissed: !closing, url: nil)
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    return QasimhaCheckout.keyWindow() ?? ASPresentationAnchor()
  }

  private static func keyWindow() -> UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let windows = scenes.flatMap { $0.windows }
    return windows.first { $0.isKeyWindow } ?? windows.first
  }

  private static func topViewController() -> UIViewController? {
    var top = keyWindow()?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}
