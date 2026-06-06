import Foundation

/// Minimal HTTP client for API Gateway. Sends `Authorization: Bearer <id_token>` per `docs/DESKTOP_APP_API_CONTRACT.md`.
actor ApiClient {
    private let baseURL: URL
    private let baseURL2: URL?
    private let tokenProvider: @Sendable () -> String?

    init(baseURL: URL, baseURL2: URL? = nil, tokenProvider: @escaping @Sendable () -> String?) {
        self.baseURL = baseURL
        self.baseURL2 = baseURL2
        self.tokenProvider = tokenProvider
    }

    init(configuration: DesktopConfiguration, tokenProvider: @escaping @Sendable () -> String?) {
        self.init(baseURL: configuration.apiBaseURL, baseURL2: configuration.apiBaseURL2, tokenProvider: tokenProvider)
    }

    /// Hospital + comms routes live on stack 2 (`API_BASE_URL_2`); core incident routes on stack 1.
    private func resolveBaseURL(forPath path: String) -> URL {
        let normalized = path.hasPrefix("/") ? path : "/\(path)"
        if let secondary = baseURL2, Self.usesStack2Api(normalized) {
            return secondary
        }
        return baseURL
    }

    private static func usesStack2Api(_ path: String) -> Bool {
        path.hasPrefix("/api/hospitals")
            || path.hasPrefix("/api/dispatcher/")
            || path.hasPrefix("/api/supervisor/")
            || path.hasPrefix("/api/wellness/")
    }

    func pingHealth() async throws -> (status: Int, body: String) {
        try await get(path: "/api/health", authorized: false)
    }

    func fetchIncidentsPreview() async throws -> (status: Int, body: String) {
        try await get(path: "/api/incidents", authorized: true)
    }

    /// Validates the current **id_token** with the API (`GET /api/me`).
    func fetchMe() async throws -> (status: Int, body: String) {
        try await get(path: "/api/me", authorized: true)
    }

    /// `POST /api/hospitals/recommendations` — hospital routing (requires `ENABLE_HOSPITAL_ROUTING` on API).
    func fetchHospitalRecommendations(
        latitude: Double,
        longitude: Double,
        patientNeeds: PatientNeedsDTO?
    ) async throws -> [HospitalRecommendationDTO] {
        let body = HospitalRecommendationsRequest(
            latitude: latitude,
            longitude: longitude,
            patientNeeds: patientNeeds
        )
        let data = try JSONEncoder().encode(body)
        let (status, raw) = try await post(path: "/api/hospitals/recommendations", body: data, authorized: true)
        guard (200 ... 299).contains(status) else {
            throw ApiClientError.http(status: status, body: raw)
        }
        let decoded = try JSONDecoder().decode(HospitalRecommendationsResponse.self, from: Data(raw.utf8))
        return decoded.items
    }

    private func post(path: String, body: Data, authorized: Bool) async throws -> (status: Int, body: String) {
        let url = Self.join(baseURL: resolveBaseURL(forPath: path), path: path)
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = body
        if authorized, let token = tokenProvider() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        return (code, String(data: data, encoding: .utf8) ?? "")
    }

    private func get(path: String, authorized: Bool) async throws -> (status: Int, body: String) {
        let url = Self.join(baseURL: resolveBaseURL(forPath: path), path: path)
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if authorized, let token = tokenProvider() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        return (code, String(data: data, encoding: .utf8) ?? "")
    }

    private static func join(baseURL: URL, path: String) -> URL {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var base = baseURL.absoluteString
        if base.hasSuffix("/") == false { base += "/" }
        return URL(string: base + trimmed) ?? baseURL
    }
}
