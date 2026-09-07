import Foundation

@MainActor
final class RCAPIClient: ObservableObject {
    static let shared = RCAPIClient()
    private init() {}

    private let decoder = JSONDecoder()

    func listCodes(agencyId: String) async throws -> [QRNFCCode] {
        let encoded = agencyId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? agencyId
        let envelope: MobileEnvelope<CodesListPayload> = try await get(path: "/api/codes?agencyId=\(encoded)")
        try throwEnvelopeError(envelope)
        return (envelope.data?.codes ?? []).map(QRNFCCode.fromLiveCode)
    }

    func createCode(agencyId: String, request: NewQRNFCCodeRequest) async throws -> QRNFCCode {
        let envelope: MobileEnvelope<CodePayload> = try await post(path: "/api/codes", body: request)
        try throwEnvelopeError(envelope)
        guard let dto = envelope.data?.code else { throw RCAPIError.serverError(500, "Missing created code") }
        return QRNFCCode.fromLiveCode(dto)
    }

    func recordNFCWrite(agencyId: String, qrId: String, bytesWritten: Int, tagType: String = "NTAG213") async throws {
        let writtenBy = CognitoAuthManager.shared.claims?.sub ?? "ios-field"
        let body: [String: Any] = [
            "writtenBy": writtenBy,
            "devicePlatform": "ios",
            "writeMethod": "native_nfc",
            "bytesWritten": bytesWritten,
            "tagType": tagType
        ]
        try await postJSON(path: "/api/codes/\(qrId)/nfc-write", json: body)
        _ = agencyId
    }

    func deactivateCode(agencyId: String, qrId: String) async throws {
        _ = agencyId
        try await delete(path: "/api/codes/\(qrId)")
    }

    func listAgencies() async throws -> [Agency] {
        let resp: RCListResponse<AgencyDTO> = try await get(path: "/api/agencies")
        return (resp.items).map(Agency.init(from:))
    }

    func getAgency(agencyId: String) async throws -> Agency {
        let dto: AgencyDTO = try await get(path: "/api/agencies/\(agencyId)")
        return Agency(from: dto)
    }

    private func get<T: Decodable>(path: String) async throws -> T {
        let req = try await buildRequest(method: "GET", path: path)
        return try await execute(req)
    }

    private func post<T: Decodable, B: Encodable>(path: String, body: B) async throws -> T {
        var req = try await buildRequest(method: "POST", path: path)
        req.httpBody = try JSONEncoder().encode(body)
        return try await execute(req)
    }

    private func postJSON(path: String, json: [String: Any]) async throws {
        var req = try await buildRequest(method: "POST", path: path)
        req.httpBody = try JSONSerialization.data(withJSONObject: json)
        try await executeVoid(req)
    }

    private func delete(path: String) async throws {
        let req = try await buildRequest(method: "DELETE", path: path)
        try await executeVoid(req)
    }

    private func buildRequest(method: String, path: String) async throws -> URLRequest {
        let base = RCConfig.apiBaseURL
        guard let url = URL(string: base + path) else {
            throw RCAPIError.invalidURL(path)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("RCMobile-iOS/1.0", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 15

        let token = try await CognitoAuthManager.shared.validIdToken()
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return req
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        try throwIfFailed(data: data, response: response)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw RCAPIError.serverError(200, "Could not parse server response.")
        }
    }

    private func executeVoid(_ request: URLRequest) async throws {
        let (data, response) = try await URLSession.shared.data(for: request)
        try throwIfFailed(data: data, response: response)
    }

    private func throwIfFailed(data: Data, response: URLResponse) throws {
        guard let httpResp = response as? HTTPURLResponse else {
            throw RCAPIError.networkError
        }
        switch httpResp.statusCode {
        case 200...299:
            return
        case 401:
            throw RCAPIError.unauthorized
        case 403:
            throw RCAPIError.forbidden
        case 404:
            throw RCAPIError.notFound
        case 429:
            throw RCAPIError.rateLimited
        default:
            let msg = decodeErrorMessage(data)
            throw RCAPIError.serverError(httpResp.statusCode, msg)
        }
    }

    private func decodeErrorMessage(_ data: Data) -> String? {
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let error = obj["error"] as? String { return error }
            if let message = obj["message"] as? String { return message }
        }
        return nil
    }

    private func throwEnvelopeError<T>(_ envelope: MobileEnvelope<T>) throws {
        if envelope.success == false {
            throw RCAPIError.serverError(400, envelope.error ?? "Request failed")
        }
    }
}

enum RCAPIError: LocalizedError {
    case invalidURL(String)
    case networkError
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case serverError(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidURL(let p): return "Invalid URL: \(p)"
        case .networkError: return "Network unavailable. Check connectivity."
        case .unauthorized: return "Session expired. Sign in again."
        case .forbidden: return "You don't have permission for this action."
        case .notFound: return "Resource not found."
        case .rateLimited: return "Too many requests. Wait a moment."
        case .serverError(_, let m): return m ?? "Server error."
        }
    }
}
