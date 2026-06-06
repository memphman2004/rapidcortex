import AppKit
import CryptoKit
import Foundation
import os.log

/// Cognito OAuth2 authorization code + PKCE via **system browser**: opens the web app’s
/// `/auth/native-login` → branded `/login` → Cognito → `/auth/return-to-app` → custom URL scheme back to this app.
/// Requires `WEB_APP_BASE_URL` or `NEXT_PUBLIC_SITE_URL` in configuration (see `AppEnvironment`).
@MainActor
final class CognitoWebAuthCoordinator: ObservableObject {
    private static let log = Logger(subsystem: "com.rapidcortex.desktop", category: "auth")

    private var bridgeContinuation: CheckedContinuation<Void, Error>?
    private var bridgePending: (verifier: String, state: String, redirectUri: String)?
    private var bridgeConfig: DesktopConfiguration?

    /// Opens the web sign-in bridge in the default browser; on deep link callback exchanges `code` via web BFF and stores tokens in Keychain.
    func signInWithHostedUI(config: DesktopConfiguration) async throws {
        guard config.isConfigured else {
            Self.log.error("signIn aborted: missing configuration")
            throw CognitoAuthError.missingConfiguration
        }
        guard let web = config.webAppBaseURL else {
            Self.log.error("signIn aborted: no web app origin (WEB_APP_BASE_URL or NEXT_PUBLIC_SITE_URL)")
            throw CognitoAuthError.missingWebAppBaseURL
        }
        try await signInViaSystemBrowserBridge(config: config, webAppBase: web)
    }

    /// Call from SwiftUI `.onOpenURL` when `rapidcortex://oauth/callback?code=&state=` is delivered.
    func handleOAuthCallbackURL(_ url: URL) {
        guard let cont = bridgeContinuation else { return }
        bridgeContinuation = nil
        Task { @MainActor in
            do {
                try await completeBridgeCallback(url: url)
                cont.resume()
            } catch {
                cont.resume(throwing: error)
            }
        }
    }

    private func signInViaSystemBrowserBridge(config: DesktopConfiguration, webAppBase: URL) async throws {
        let verifier = Self.randomPKCEVerifier()
        let challenge = Self.pkceChallengeS256(from: verifier)
        let expectedState = Self.randomState()
        let returnToApp = Self.returnToAppURL(webBase: webAppBase)
        bridgePending = (verifier: verifier, state: expectedState, redirectUri: returnToApp)
        bridgeConfig = config

        let bridgeURL = webAppBase.appendingPathComponent("auth/native-login", isDirectory: false)
        var bridge = URLComponents(url: bridgeURL, resolvingAgainstBaseURL: false)
        bridge?.queryItems = [
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "state", value: expectedState),
            URLQueryItem(name: "redirect_uri", value: returnToApp),
            URLQueryItem(name: "app_callback", value: config.cognitoRedirectURI),
        ]
        guard let startURL = bridge?.url else {
            bridgePending = nil
            bridgeConfig = nil
            throw CognitoAuthError.badAuthorizeURL
        }

        Self.log.info("Opening system browser for native-login bridge (PKCE)")

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            bridgeContinuation = continuation
            let opened = NSWorkspace.shared.open(startURL)
            if !opened {
                bridgeContinuation = nil
                bridgePending = nil
                bridgeConfig = nil
                continuation.resume(throwing: CognitoAuthError.sessionFailedToStart)
            }
        }
    }

    private func completeBridgeCallback(url: URL) async throws {
        guard let cfgSnapshot = bridgeConfig else {
            bridgePending = nil
            throw CognitoAuthError.missingConfiguration
        }
        defer {
            bridgePending = nil
            bridgeConfig = nil
        }
        guard let pending = bridgePending else {
            throw CognitoAuthError.noCallback
        }
        if let oauth = Self.parseOAuthCallbackError(from: url) {
            Self.log.error("OAuth callback error: \(oauth.error, privacy: .public)")
            throw CognitoAuthError.oauthAuthorizationFailed(oauth.error, oauth.errorDescription)
        }
        guard Self.parseState(from: url) == pending.state else {
            throw CognitoAuthError.stateMismatch
        }
        guard let code = Self.parseAuthorizationCode(from: url) else {
            throw CognitoAuthError.missingAuthorizationCode
        }
        guard let web = cfgSnapshot.webAppBaseURL else {
            throw CognitoAuthError.missingConfiguration
        }
        Self.log.info("Exchanging authorization code via web BFF")
        let tokens = try await Self.exchangeViaBff(
            code: code,
            codeVerifier: pending.verifier,
            redirectUri: pending.redirectUri,
            webAppBase: web
        )
        try KeychainTokenStore.saveIdToken(tokens.idToken)
        try KeychainTokenStore.saveAccessToken(tokens.accessToken)
        if let refresh = tokens.refreshToken {
            try KeychainTokenStore.saveRefreshToken(refresh)
        }
        if let expiresIn = tokens.expiresIn {
            try KeychainTokenStore.saveAccessTokenExpiry(Date().addingTimeInterval(TimeInterval(expiresIn)))
        }
    }

    func refreshSession(config: DesktopConfiguration) async throws {
        guard let refreshToken = KeychainTokenStore.refreshToken() else {
            throw CognitoAuthError.missingRefreshToken
        }
        let tokens: CognitoTokenResponse
        if let web = config.webAppBaseURL {
            tokens = try await Self.refreshViaBff(refreshToken: refreshToken, webAppBase: web)
        } else {
            tokens = try await Self.exchangeRefreshToken(refreshToken, config: config)
        }
        try KeychainTokenStore.saveIdToken(tokens.idToken)
        try KeychainTokenStore.saveAccessToken(tokens.accessToken)
        if let returnedRefresh = tokens.refreshToken, !returnedRefresh.isEmpty {
            try KeychainTokenStore.saveRefreshToken(returnedRefresh)
        }
        if let expiresIn = tokens.expiresIn {
            try KeychainTokenStore.saveAccessTokenExpiry(Date().addingTimeInterval(TimeInterval(expiresIn)))
        }
    }

    func signOutWithHostedUI(config: DesktopConfiguration) {
        try? KeychainTokenStore.clearAll()
        guard let logoutURL = Self.logoutURL(config: config) else { return }
        NSWorkspace.shared.open(logoutURL)
    }

    private static func returnToAppURL(webBase: URL) -> String {
        webBase.appendingPathComponent("auth/return-to-app", isDirectory: false).absoluteString
    }

    private static func exchangeViaBff(
        code: String,
        codeVerifier: String,
        redirectUri: String,
        webAppBase: URL
    ) async throws -> CognitoTokenResponse {
        let endpoint = webAppBase.appendingPathComponent("api/auth/native/token", isDirectory: false)
        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = [
            "code": code,
            "codeVerifier": codeVerifier,
            "redirectUri": redirectUri,
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ... 299).contains(status) else {
            let text = String(data: data, encoding: .utf8)?.prefix(500) ?? ""
            throw CognitoAuthError.tokenEndpointHttpError(status, String(text))
        }
        return try JSONDecoder().decode(CognitoTokenResponse.self, from: data)
    }

    private static func refreshViaBff(
        refreshToken: String,
        webAppBase: URL
    ) async throws -> CognitoTokenResponse {
        let endpoint = webAppBase.appendingPathComponent("api/auth/native/token", isDirectory: false)
        var req = URLRequest(url: endpoint)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = ["refreshToken": refreshToken]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ... 299).contains(status) else {
            throw CognitoAuthError.tokenEndpointHttpError(status, "refresh failed")
        }
        guard let decoded = try? JSONDecoder().decode(CognitoTokenResponse.self, from: data), !decoded.idToken.isEmpty else {
            throw CognitoAuthError.tokenResponseInvalid
        }
        return decoded
    }

    private static func parseAuthorizationCode(from url: URL) -> String? {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        return items.first { $0.name == "code" }?.value
    }

    private static func parseState(from url: URL) -> String? {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        return items.first { $0.name == "state" }?.value
    }

    private struct OAuthCallbackError {
        let error: String
        let errorDescription: String?
    }

    private static func parseOAuthCallbackError(from url: URL) -> OAuthCallbackError? {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return nil }
        guard let err = items.first(where: { $0.name == "error" })?.value else { return nil }
        let desc = items.first { $0.name == "error_description" }?.value
        return OAuthCallbackError(error: err, errorDescription: desc)
    }

    private static func tokenEndpointURL(config: DesktopConfiguration) -> URL? {
        var c = URLComponents()
        c.scheme = "https"
        c.host = config.cognitoDomain
        c.path = "/oauth2/token"
        return c.url
    }

    private static func logoutURL(config: DesktopConfiguration) -> URL? {
        var c = URLComponents()
        c.scheme = "https"
        c.host = config.cognitoDomain
        c.path = "/logout"
        c.queryItems = [
            URLQueryItem(name: "client_id", value: config.cognitoClientId),
            URLQueryItem(name: "logout_uri", value: config.cognitoLogoutURI),
        ]
        return c.url
    }

    private static func exchangeRefreshToken(
        _ refreshToken: String,
        config: DesktopConfiguration
    ) async throws -> CognitoTokenResponse {
        guard let url = tokenEndpointURL(config: config) else {
            throw CognitoAuthError.tokenEndpointInvalid
        }
        var uc = URLComponents()
        uc.queryItems = [
            URLQueryItem(name: "grant_type", value: "refresh_token"),
            URLQueryItem(name: "client_id", value: config.cognitoClientId),
            URLQueryItem(name: "refresh_token", value: refreshToken),
        ]
        guard let bodyString = uc.percentEncodedQuery, let body = bodyString.data(using: .utf8) else {
            throw CognitoAuthError.tokenRequestBuildFailed
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = body
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200 ... 299).contains(status) else {
            throw CognitoAuthError.tokenEndpointHttpError(status, "refresh failed")
        }
        guard let decoded = try? JSONDecoder().decode(CognitoTokenResponse.self, from: data), !decoded.idToken.isEmpty else {
            throw CognitoAuthError.tokenResponseInvalid
        }
        return decoded
    }

    private static func randomPKCEVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private static func randomState() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private static func pkceChallengeS256(from verifier: String) -> String {
        let hash = SHA256.hash(data: Data(verifier.utf8))
        return Data(hash).base64URLEncodedString()
    }

    // MARK: - Token models

    private struct CognitoTokenResponse: Decodable {
        let idToken: String
        let accessToken: String
        let refreshToken: String?
        let tokenType: String?
        let expiresIn: Int?

        enum CodingKeys: String, CodingKey {
            case idToken = "id_token"
            case accessToken = "access_token"
            case refreshToken = "refresh_token"
            case tokenType = "token_type"
            case expiresIn = "expires_in"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            idToken = try c.decode(String.self, forKey: .idToken)
            accessToken = try c.decodeIfPresent(String.self, forKey: .accessToken) ?? ""
            refreshToken = try c.decodeIfPresent(String.self, forKey: .refreshToken)
            tokenType = try c.decodeIfPresent(String.self, forKey: .tokenType)
            expiresIn = try c.decodeIfPresent(Int.self, forKey: .expiresIn)
        }
    }

    enum CognitoAuthError: Error {
        case missingConfiguration
        case missingWebAppBaseURL
        case badAuthorizeURL
        case noCallback
        case sessionFailedToStart
        case userCancelled
        case missingAuthorizationCode
        case stateMismatch
        case missingRefreshToken
        case tokenEndpointInvalid
        case tokenRequestBuildFailed
        case tokenResponseInvalid
        case oauthAuthorizationFailed(String, String?)
        case tokenEndpointRejected(Int, String, String?)
        case tokenEndpointHttpError(Int, String)
    }
}

extension CognitoWebAuthCoordinator.CognitoAuthError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .missingConfiguration:
            return "Missing API or Cognito settings. Add Secrets.plist to the app target and reload."
        case .missingWebAppBaseURL:
            return "Add WEB_APP_BASE_URL or NEXT_PUBLIC_SITE_URL to Secrets.plist (your Rapid Cortex website origin, e.g. https://www.rapidcortex.us). Sign-in opens that site in your browser, then returns to the app."
        case .badAuthorizeURL:
            return "Could not build Cognito authorize URL. Check COGNITO_DOMAIN and COGNITO_CLIENT_ID."
        case .noCallback:
            return "Sign-in did not return to the app. Check COGNITO_REDIRECT_URI matches the Cognito app client."
        case .sessionFailedToStart:
            return "Could not start the system browser for sign-in."
        case .userCancelled:
            return "Sign-in was cancelled."
        case .missingAuthorizationCode:
            return "No authorization code in callback URL."
        case .stateMismatch:
            return "Sign-in callback did not match the expected state value."
        case .missingRefreshToken:
            return "No refresh token available for session restore."
        case .tokenEndpointInvalid:
            return "Invalid Cognito token URL."
        case .tokenRequestBuildFailed:
            return "Could not build token request."
        case .tokenResponseInvalid:
            return "Unexpected token response from Cognito."
        case let .oauthAuthorizationFailed(code, desc):
            return "Cognito: \(code)" + (desc.map { " — \($0)" } ?? "")
        case let .tokenEndpointRejected(status, code, desc):
            return "Token exchange failed (\(status)): \(code)" + (desc.map { " — \($0)" } ?? "")
        case let .tokenEndpointHttpError(status, fragment):
            return "Token exchange failed (HTTP \(status)): \(fragment)"
        }
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
