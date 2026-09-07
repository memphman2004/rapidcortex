import Combine
import Foundation

@MainActor
final class CognitoAuthManager: ObservableObject {
    static let shared = CognitoAuthManager()

    private static let selectedAgencyKey = "rc_selected_agency_id"

    @Published private(set) var isAuthenticated = false
    @Published private(set) var claims: RCUserClaims?
    @Published private(set) var isLoading = false
    @Published var error: String?

    @Published var requiresMFA = false
    @Published var mfaCode = ""
    /// Agency used for `/api/codes` (platform admins may switch).
    @Published var selectedAgencyId = ""

    private var pendingSession: String?
    private var pendingUsername: String?

    private var accessToken: String?
    private var idToken: String?
    private var refreshToken: String?
    private var tokenExpiry: Date?

    private var baseURL: String {
        "https://cognito-idp.\(RCConfig.cognitoRegion).amazonaws.com/"
    }

    private init() { restoreSession() }

    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let username = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let srpHelper = CognitoSRPHelper(
                username: username,
                password: password,
                userPoolId: RCConfig.userPoolId
            )
            let (srpA, _) = srpHelper.initiate()

            let initiateBody: [String: Any] = [
                "AuthFlow": "USER_SRP_AUTH",
                "ClientId": RCConfig.clientId,
                "AuthParameters": [
                    "USERNAME": username,
                    "SRP_A": srpA
                ]
            ]

            let initiateResp = try await cognitoRequest(
                target: "AWSCognitoIdentityProviderService.InitiateAuth",
                body: initiateBody
            )

            if initiateResp["AuthenticationResult"] != nil {
                try handleAuthResult(initiateResp)
                return
            }

            guard let challenge = initiateResp["ChallengeName"] as? String else {
                throw AuthError.unexpectedChallenge
            }

            if challenge == "PASSWORD_VERIFIER" {
                guard let challengeParams = initiateResp["ChallengeParameters"] as? [String: String] else {
                    throw AuthError.unexpectedChallenge
                }
                pendingUsername = challengeParams["USER_ID_FOR_SRP"] ?? username
                let srpAnswer = try srpHelper.respondToChallenge(params: challengeParams)

                var respondBody: [String: Any] = [
                    "ChallengeName": "PASSWORD_VERIFIER",
                    "ClientId": RCConfig.clientId,
                    "ChallengeResponses": srpAnswer
                ]
                if let session = initiateResp["Session"] as? String {
                    respondBody["Session"] = session
                }

                let respondResp = try await cognitoRequest(
                    target: "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
                    body: respondBody
                )
                try handleChallengeOrResult(respondResp)
                return
            }

            throw AuthError.cognitoError("Unexpected auth challenge: \(challenge)")
        } catch {
            self.error = error.localizedDescription
        }
    }

    func submitMFA() async {
        guard let session = pendingSession, !mfaCode.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let username = pendingUsername ?? claims?.email ?? ""
            let body: [String: Any] = [
                "ChallengeName": "SOFTWARE_TOKEN_MFA",
                "ClientId": RCConfig.clientId,
                "ChallengeResponses": [
                    "SOFTWARE_TOKEN_MFA_CODE": mfaCode,
                    "USERNAME": username
                ],
                "Session": session
            ]

            let resp = try await cognitoRequest(
                target: "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
                body: body
            )

            requiresMFA = false
            pendingSession = nil
            mfaCode = ""
            try handleAuthResult(resp)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func refreshIfNeeded() async {
        guard let expiry = tokenExpiry, expiry > Date().addingTimeInterval(60) else {
            await refresh()
            return
        }
    }

    func signOut() {
        accessToken = nil
        idToken = nil
        refreshToken = nil
        tokenExpiry = nil
        claims = nil
        isAuthenticated = false
        requiresMFA = false
        pendingSession = nil
        pendingUsername = nil
        selectedAgencyId = ""
        UserDefaults.standard.removeObject(forKey: Self.selectedAgencyKey)
        KeychainManager.deleteAll()
    }

    func selectAgency(_ agencyId: String) {
        selectedAgencyId = agencyId
        UserDefaults.standard.set(agencyId, forKey: Self.selectedAgencyKey)
    }

    /// ID token — Lambdas read `custom:role` / `custom:agencyId` from it.
    func validIdToken() async throws -> String {
        if let expiry = tokenExpiry, expiry < Date().addingTimeInterval(60) {
            await refresh()
        }
        guard let token = idToken else { throw AuthError.notAuthenticated }
        return token
    }

    func validAccessToken() async throws -> String {
        try await validIdToken()
    }

    // MARK: - Private

    private func handleChallengeOrResult(_ resp: [String: Any]) throws {
        if let nextChallenge = resp["ChallengeName"] as? String {
            if nextChallenge == "SOFTWARE_TOKEN_MFA" || nextChallenge == "SMS_MFA" {
                pendingSession = resp["Session"] as? String
                requiresMFA = true
                return
            }
            if nextChallenge == "NEW_PASSWORD_REQUIRED" {
                throw AuthError.cognitoError("Password reset required. Use the Rapid Cortex web app, then sign in here.")
            }
            throw AuthError.cognitoError("Unexpected auth challenge: \(nextChallenge)")
        }
        try handleAuthResult(resp)
    }

    private func handleAuthResult(_ resp: [String: Any]) throws {
        guard let authResult = resp["AuthenticationResult"] as? [String: Any],
              let at = authResult["AccessToken"] as? String,
              let it = authResult["IdToken"] as? String
        else { throw AuthError.invalidResponse }

        let rt = (authResult["RefreshToken"] as? String) ?? refreshToken
        guard let rt else { throw AuthError.invalidResponse }

        let expiresIn = (authResult["ExpiresIn"] as? Int) ?? 3600

        accessToken = at
        idToken = it
        refreshToken = rt
        tokenExpiry = Date().addingTimeInterval(TimeInterval(expiresIn))
        claims = try JWTDecoder.decode(idToken: it)
        applySelectedAgency()
        isAuthenticated = true

        KeychainManager.save(key: "rc_access_token", value: at)
        KeychainManager.save(key: "rc_id_token", value: it)
        KeychainManager.save(key: "rc_refresh_token", value: rt)
    }

    private func applySelectedAgency() {
        let stored = UserDefaults.standard.string(forKey: Self.selectedAgencyKey) ?? ""
        if claims?.isPlatformAdmin == true, !stored.isEmpty {
            selectedAgencyId = stored
        } else {
            selectedAgencyId = claims?.agencyId ?? stored
        }
    }

    private func restoreSession() {
        if let it = KeychainManager.load(key: "rc_id_token"),
           let decoded = try? JWTDecoder.decode(idToken: it) {
            idToken = it
            accessToken = KeychainManager.load(key: "rc_access_token")
            claims = decoded
            applySelectedAgency()
            isAuthenticated = true
        }
        guard let rt = KeychainManager.load(key: "rc_refresh_token") else { return }
        refreshToken = rt
        Task { await refresh() }
    }

    private func refresh() async {
        guard let rt = refreshToken else {
            if isAuthenticated { signOut() }
            return
        }
        do {
            let body: [String: Any] = [
                "AuthFlow": "REFRESH_TOKEN_AUTH",
                "ClientId": RCConfig.clientId,
                "AuthParameters": ["REFRESH_TOKEN": rt]
            ]
            let resp = try await cognitoRequest(
                target: "AWSCognitoIdentityProviderService.InitiateAuth",
                body: body
            )
            try handleAuthResult(resp)
        } catch {
            signOut()
        }
    }

    private func cognitoRequest(target: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: baseURL) else { throw AuthError.networkError }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-amz-json-1.1", forHTTPHeaderField: "Content-Type")
        request.setValue(target, forHTTPHeaderField: "X-Amz-Target")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResp = response as? HTTPURLResponse else { throw AuthError.networkError }

        if httpResp.statusCode != 200 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let message = (json["message"] as? String) ?? (json["__type"] as? String)
                throw AuthError.cognitoError(message ?? "Authentication failed.")
            }
            throw AuthError.httpError(httpResp.statusCode)
        }

        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}

enum AuthError: LocalizedError {
    case unexpectedChallenge
    case invalidResponse
    case notAuthenticated
    case networkError
    case cognitoError(String)
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .unexpectedChallenge: return "Unexpected auth challenge from Cognito."
        case .invalidResponse: return "Invalid authentication response."
        case .notAuthenticated: return "Not signed in."
        case .networkError: return "Network error. Check connectivity."
        case .cognitoError(let msg): return msg
        case .httpError(let code): return "Server error (\(code))."
        }
    }
}

enum JWTDecoder {
    static func decode(idToken: String) throws -> RCUserClaims {
        let parts = idToken.split(separator: ".")
        guard parts.count == 3 else { throw AuthError.invalidResponse }

        var b64 = String(parts[1])
        while b64.count % 4 != 0 { b64 += "=" }
        b64 = b64.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        guard let data = Data(base64Encoded: b64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw AuthError.invalidResponse }

        return RCUserClaims(
            email: json["email"] as? String ?? "",
            role: json["custom:role"] as? String ?? "",
            agencyId: json["custom:agencyId"] as? String ?? "",
            sub: json["sub"] as? String ?? ""
        )
    }
}
