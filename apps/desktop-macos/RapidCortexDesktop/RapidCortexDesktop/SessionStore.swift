import Combine
import Foundation
import os.log
import WebKit

@MainActor
final class SessionStore: ObservableObject {
    private static let log = Logger(subsystem: "com.rapidcortex.desktop", category: "session")

    @Published private(set) var configuration: DesktopConfiguration
    @Published var isSignedIn: Bool
    @Published var lastError: String? {
        didSet {
            if let e = lastError, !e.isEmpty {
                Self.log.warning("Session error: \(e, privacy: .public)")
            }
        }
    }

    init() {
        configuration = AppEnvironment.loadConfiguration()
        isSignedIn = KeychainTokenStore.idToken() != nil
    }

    func reloadConfiguration() {
        configuration = AppEnvironment.loadConfiguration()
        isSignedIn = KeychainTokenStore.idToken() != nil
    }

    func signOut() {
        clearDesktopWebAuthCookies()
        do {
            try KeychainTokenStore.clearAll()
            isSignedIn = false
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func signOutWithHostedUI(cognito: CognitoWebAuthCoordinator) {
        isSignedIn = false
        lastError = nil
        clearDesktopWebAuthCookies()
        cognito.signOutWithHostedUI(config: configuration)
    }

    /// Phase 1: store an **id_token** obtained out-of-band (until Hosted UI token exchange is implemented).
    func applyIdTokenForSmokeTest(_ token: String) {
        do {
            try KeychainTokenStore.saveIdToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
            isSignedIn = true
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func idTokenForApi() -> String? {
        KeychainTokenStore.idToken()
    }

    /// Call after `signInWithHostedUI` writes tokens to Keychain.
    func syncSessionFromKeychain() {
        isSignedIn = KeychainTokenStore.idToken() != nil
    }

    func restoreSessionIfNeeded(cognito: CognitoWebAuthCoordinator) async {
        guard let idToken = KeychainTokenStore.idToken() else {
            isSignedIn = false
            return
        }
        if !Self.isLikelyExpired(jwt: idToken) {
            isSignedIn = true
            return
        }
        do {
            try await cognito.refreshSession(config: configuration)
            isSignedIn = KeychainTokenStore.idToken() != nil
        } catch {
            do {
                try KeychainTokenStore.clearAll()
            } catch {}
            isSignedIn = false
            lastError = "Session expired. Please sign in again."
        }
    }

    private static func isLikelyExpired(jwt: String) -> Bool {
        let parts = jwt.split(separator: ".")
        guard parts.count >= 2 else { return true }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let pad = 4 - (payload.count % 4)
        if pad < 4 { payload += String(repeating: "=", count: pad) }
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = json["exp"] as? TimeInterval
        else { return true }
        return Date().timeIntervalSince1970 >= exp
    }
}
