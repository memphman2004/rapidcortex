import Foundation

/// Runtime configuration for Rapid Cortex Mobile (iOS).
/// Info.plist values are filled from `Config/Config.xcconfig` at build time.
enum RCConfig {
    static var cognitoRegion: String {
        plist("RC_COGNITO_REGION", fallback: "us-east-1")
    }

    static var userPoolId: String {
        plist("RC_COGNITO_USER_POOL_ID", fallback: "us-east-1_0z6tA6WBs")
    }

    /// Public native app client (no secret). Same users/passwords as Android + web.
    static var clientId: String {
        plist("RC_COGNITO_CLIENT_ID", fallback: "3nkemnrffspnaa0ikp2un6koh0")
    }

    static var apiBaseURL: String {
        let candidate = plist("RC_API_BASE_URL", fallback: "https://api.rapidcortex.us")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if let host = URL(string: candidate)?.host, host.contains(".") {
            return candidate
        }
        return "https://api.rapidcortex.us"
    }

    private static func plist(_ key: String, fallback: String) -> String {
        let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed.hasPrefix("$(") { return fallback }
        return trimmed
    }
}
