import Foundation

/// Deployment slice for API + Cognito settings. Override with scheme env `RC_ENVIRONMENT` or `Secrets.plist`.
enum AppEnvironment: String, CaseIterable {
    case development
    case staging
    case production

    static var current: AppEnvironment {
        if let raw = ProcessInfo.processInfo.environment["RC_ENVIRONMENT"]?.lowercased(),
           let e = AppEnvironment(rawValue: raw) {
            return e
        }
        if let raw = Bundle.main.object(forInfoDictionaryKey: "RC_ENVIRONMENT") as? String,
           let e = AppEnvironment(rawValue: raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) {
            return e
        }
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }

    /// Loads merged config: `Secrets.plist` in bundle (copy from `Config/Secrets.example.plist`) then env overrides.
    static func loadConfiguration() -> DesktopConfiguration {
        var dict = [String: String]()
        if let url = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
           let data = try? Data(contentsOf: url),
           let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] {
            for (k, v) in plist {
                if let s = v as? String { dict[k] = s }
            }
        }
        let env = ProcessInfo.processInfo.environment
        func pick(_ key: String) -> String? {
            env[key]?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? dict[key]?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
        }
        guard let baseRaw = pick("API_BASE_URL")?.trimmingCharacters(in: .whitespacesAndNewlines), !baseRaw.isEmpty,
              let base = URL(string: baseRaw) else {
            return AppEnvironment.placeholder
        }
        let base2Raw = pick("API_BASE_URL_2")?.trimmingCharacters(in: .whitespacesAndNewlines)
        let base2 = base2Raw.flatMap { URL(string: $0) }
        let webPrimary = pick("WEB_APP_BASE_URL")?.trimmingCharacters(in: .whitespacesAndNewlines)
        let webFallback = pick("NEXT_PUBLIC_SITE_URL")?.trimmingCharacters(in: .whitespacesAndNewlines)
        let webResolved: String? = {
            if let p = webPrimary, !p.isEmpty { return p }
            if let f = webFallback, !f.isEmpty { return f }
            return nil
        }()
        let webURL: URL? = {
            guard let webRaw = webResolved, !webRaw.isEmpty, let u = URL(string: webRaw) else { return nil }
            return Self.normalizeWebAppBase(u)
        }()
        let jurisdictionSlug = (pick("DEFAULT_JURISDICTION_SLUG") ?? pick("NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let nativeMapkit = (pick("ENABLE_NATIVE_MAPKIT") ?? "1")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let enableNativeMapKit = nativeMapkit == "1" || nativeMapkit.lowercased() == "true"
        return DesktopConfiguration(
            apiBaseURL: base,
            apiBaseURL2: base2,
            cognitoRegion: pick("COGNITO_REGION") ?? "us-east-1",
            cognitoDomain: Self.normalizeCognitoDomain(pick("COGNITO_DOMAIN") ?? ""),
            cognitoClientId: (pick("COGNITO_CLIENT_ID") ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
            cognitoRedirectURI: (pick("COGNITO_REDIRECT_URI") ?? "rapidcortex-desktop://oauth/callback")
                .trimmingCharacters(in: .whitespacesAndNewlines),
            cognitoLogoutURI: (pick("COGNITO_LOGOUT_URI") ?? "rapidcortex-desktop://logout/callback")
                .trimmingCharacters(in: .whitespacesAndNewlines),
            webAppBaseURL: webURL,
            defaultJurisdictionSlug: jurisdictionSlug,
            enableNativeMapKit: enableNativeMapKit,
            environment: current
        )
    }

    /// Strips `https://`, `http://`, and path segments so the host is suitable for `URLComponents` (`host.auth.region.amazoncognito.com`).
    private static func normalizeCognitoDomain(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.lowercased().hasPrefix("https://") { s = String(s.dropFirst(8)) }
        if s.lowercased().hasPrefix("http://") { s = String(s.dropFirst(7)) }
        if let i = s.firstIndex(of: "/") { s = String(s[..<i]) }
        if let i = s.firstIndex(of: "?") { s = String(s[..<i]) }
        return s
    }

    private static func normalizeWebAppBase(_ url: URL) -> URL {
        var s = url.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        while s.hasSuffix("/") { s.removeLast() }
        return URL(string: s) ?? url
    }

    static var placeholder: DesktopConfiguration {
        DesktopConfiguration(
            apiBaseURL: URL(string: "https://invalid.local")!,
            apiBaseURL2: nil,
            cognitoRegion: "us-east-1",
            cognitoDomain: "",
            cognitoClientId: "",
            cognitoRedirectURI: "rapidcortex-desktop://oauth/callback",
            cognitoLogoutURI: "rapidcortex-desktop://logout/callback",
            webAppBaseURL: nil,
            defaultJurisdictionSlug: "",
            enableNativeMapKit: true,
            environment: current
        )
    }
}

struct DesktopConfiguration: Sendable {
    let apiBaseURL: URL
    /// Stack-2 API (hospital routing, dispatcher, etc.). Mirrors `API_UPSTREAM_BASE_2` / `ApiBaseUrl2` on Windows.
    let apiBaseURL2: URL?
    let cognitoRegion: String
    let cognitoDomain: String
    let cognitoClientId: String
    let cognitoRedirectURI: String
    let cognitoLogoutURI: String
    /// Next.js web origin for `/auth/native-login` + BFF `/api/auth/native/token`. Use `WEB_APP_BASE_URL` or `NEXT_PUBLIC_SITE_URL` in Secrets.plist.
    let webAppBaseURL: URL?
    /// Jurisdiction path segment for agency roles (matches `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` on web).
    let defaultJurisdictionSlug: String
    /// When true, show native MapKit hospital routing (toolbar + legacy Maps tab).
    let enableNativeMapKit: Bool
    let environment: AppEnvironment

    var isConfigured: Bool {
        !cognitoDomain.isEmpty
            && !cognitoClientId.isEmpty
            && apiBaseURL.host() != "invalid.local"
            && (apiBaseURL.scheme == "https" || apiBaseURL.scheme == "http")
    }

    /// Browser-based SSO requires the same web origin the Next.js app uses (`WEB_APP_BASE_URL` or `NEXT_PUBLIC_SITE_URL`).
    var canSignInWithWeb: Bool {
        isConfigured && webAppBaseURL != nil
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
