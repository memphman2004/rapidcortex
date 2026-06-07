import Foundation
import SwiftUI
import WebKit

// MARK: - Session cookies (names match apps/web/lib/auth/cookies.ts)

private let cookieIdToken = "rc_id_token"
private let cookieAccessToken = "rc_access_token"
private let cookieRefreshToken = "rc_refresh_token"

private func cookieExpirationDate(accessExpiry: Date?) -> Date {
    accessExpiry ?? Date().addingTimeInterval(3600)
}

private func buildAuthCookies(
    host: String,
    isSecure: Bool,
    idToken: String,
    accessToken: String,
    refreshToken: String?,
    accessExpiry: Date?
) -> [HTTPCookie] {
    let accessExp = cookieExpirationDate(accessExpiry: accessExpiry)
    let refreshExp = Date().addingTimeInterval(60 * 60 * 24 * 30)

    func makeCookie(name: String, value: String, expires: Date) -> HTTPCookie? {
        var props: [HTTPCookiePropertyKey: Any] = [
            .domain: host,
            .path: "/",
            .name: name,
            .value: value,
            .secure: isSecure,
            .expires: expires,
        ]
        props[.sameSitePolicy] = "Lax"
        return HTTPCookie(properties: props)
    }

    var list: [HTTPCookie] = []
    if let c = makeCookie(name: cookieIdToken, value: idToken, expires: accessExp) { list.append(c) }
    if !accessToken.isEmpty, let c = makeCookie(name: cookieAccessToken, value: accessToken, expires: accessExp) {
        list.append(c)
    }
    if let refresh = refreshToken, !refresh.isEmpty, let c = makeCookie(name: cookieRefreshToken, value: refresh, expires: refreshExp) {
        list.append(c)
    }
    return list
}

/// Removes Rapid Cortex auth cookies from the default data store (call on sign-out).
func clearDesktopWebAuthCookies(completion: (() -> Void)? = nil) {
    let store = WKWebsiteDataStore.default().httpCookieStore
    let names: Set<String> = [cookieIdToken, cookieAccessToken, cookieRefreshToken]
    store.getAllCookies { cookies in
        let toDelete = cookies.filter { names.contains($0.name) }
        let group = DispatchGroup()
        for c in toDelete {
            group.enter()
            store.delete(c) { group.leave() }
        }
        group.notify(queue: .main) { completion?() }
    }
}

// MARK: - WKWebView

struct WorkspaceWebShellView: NSViewRepresentable {
    var webAppBaseURL: URL
    var jurisdictionSlug: String
    var reloadNonce: Int
    var onNeedsReauth: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onNeedsReauth: onNeedsReauth)
    }

    func makeNSView(context: Context) -> WKWebView {
        let wv = WKWebView(frame: .zero, configuration: context.coordinator.configuration)
        wv.navigationDelegate = context.coordinator
        wv.customUserAgent = "RapidCortexDesktop/1.0 (macOS; WKWebView) RapidCortexWebShell"
        context.coordinator.webView = wv
        context.coordinator.apply(
            webAppBaseURL: webAppBaseURL,
            jurisdictionSlug: jurisdictionSlug,
            reloadNonce: reloadNonce
        )
        return wv
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        context.coordinator.webView = nsView
        context.coordinator.apply(
            webAppBaseURL: webAppBaseURL,
            jurisdictionSlug: jurisdictionSlug,
            reloadNonce: reloadNonce
        )
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let configuration = WKWebViewConfiguration()
        let onNeedsReauth: () -> Void
        weak var webView: WKWebView?

        private var webAppBaseURL: URL?
        private var jurisdictionSlug: String = ""
        private var lastReloadNonce: Int = -1
        private var lastFingerprint: String = ""

        init(onNeedsReauth: @escaping () -> Void) {
            self.onNeedsReauth = onNeedsReauth
            super.init()
            configuration.websiteDataStore = .default()
        }

        func apply(webAppBaseURL: URL, jurisdictionSlug: String, reloadNonce: Int) {
            self.webAppBaseURL = webAppBaseURL
            self.jurisdictionSlug = jurisdictionSlug
            if reloadNonce != lastReloadNonce {
                lastReloadNonce = reloadNonce
                lastFingerprint = ""
            }
            reloadFromKeychain()
        }

        func reloadFromKeychain() {
            guard let wv = webView, let webBase = webAppBaseURL, let host = webBase.host else { return }
            guard let idToken = KeychainTokenStore.idToken(), !idToken.isEmpty else {
                onNeedsReauth()
                return
            }

            let path = DesktopRoleRouting.desktopPostLoginWebPath(
                idToken: idToken,
                jurisdictionSlug: jurisdictionSlug
            )
            guard let target = URL(string: path, relativeTo: webBase)?.absoluteURL else { return }

            let access = KeychainTokenStore.accessToken() ?? ""
            let refresh = KeychainTokenStore.refreshToken()
            let accessExpiry = KeychainTokenStore.accessTokenExpiry()

            let isSecure = (webBase.scheme?.lowercased() == "https")
            let fp = "\(idToken)|\(access)|\(path)|\(isSecure)"
            guard fp != lastFingerprint else { return }
            lastFingerprint = fp

            let cookies = buildAuthCookies(
                host: host,
                isSecure: isSecure,
                idToken: idToken,
                accessToken: access,
                refreshToken: refresh,
                accessExpiry: accessExpiry
            )
            let store = wv.configuration.websiteDataStore.httpCookieStore

            let group = DispatchGroup()
            for c in cookies {
                group.enter()
                store.setCookie(c) { group.leave() }
            }
            group.notify(queue: .main) {
                wv.load(URLRequest(url: target))
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            guard navigationResponse.isForMainFrame,
                  let http = navigationResponse.response as? HTTPURLResponse,
                  http.statusCode == 401 || http.statusCode == 403
            else {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.cancel)
            lastFingerprint = ""
            onNeedsReauth()
        }
    }
}
