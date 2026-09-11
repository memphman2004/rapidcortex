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

    /// App Store / QA tenant (`scripts/seed-test-agency-dev.ts`). Not a production PSAP.
    static var testAgencyId: String {
        plist("RC_TEST_AGENCY_ID", fallback: "test-agency")
    }

    /// `test-agency` is seeded as `type: pilot` → 911 operational dashboard.
    static var testAgencyVertical: String {
        plist("RC_TEST_AGENCY_VERTICAL", fallback: "pilot")
    }

    static let platformAgencyId = "__platform__"

    static func isTenantAgencyId(_ raw: String?) -> Bool {
        let id = (raw ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if id.isEmpty { return false }
        let lower = id.lowercased()
        if id == platformAgencyId || lower == "platform" { return false }
        return true
    }

    static func resolvedAgencyId(selected: String, jwt: String?) -> String {
        if isTenantAgencyId(selected) {
            return selected.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if isTenantAgencyId(jwt) {
            return (jwt ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return testAgencyId
    }

    private static func plist(_ key: String, fallback: String) -> String {
        let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String ?? ""
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed.hasPrefix("$(") { return fallback }
        return trimmed
    }
}
