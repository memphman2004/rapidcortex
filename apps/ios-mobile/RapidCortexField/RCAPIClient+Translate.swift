import Foundation

struct TranslateLanguageDTO: Decodable {
    let code: String
    let label: String
}

struct TranslateLanguagesResponse: Decodable {
    let languages: [TranslateLanguageDTO]
}

struct TranslateSessionDTO: Decodable {
    let sessionId: String
    let agencyId: String
    let status: String
    let subjectLanguage: String
    let primaryLanguage: String
    let segmentCount: Int
    let startedAt: String
    let endedAt: String?
    let vertical: String
}

struct TranslateSegmentDTO: Decodable {
    let segmentId: String
    let speaker: String
    let originalText: String
    let translatedText: String
    let timestamp: String
    let isFinal: Bool?
}

struct TranslateCreateResponse: Decodable {
    let session: TranslateSessionDTO
    let wsEndpoint: String?
}

struct TranslateSegmentsResponse: Decodable {
    let items: [TranslateSegmentDTO]
}

struct TranslateSessionResponse: Decodable {
    let session: TranslateSessionDTO
}

struct TranslateCloseResponse: Decodable {
    let session: TranslateSessionDTO
    let writebackQueued: Bool?
    let assistanceEncounterId: String?
}

struct TranslateWsTokenResponse: Decodable {
    let token: String
    let wsEndpoint: String
    let expiresIn: Int?
}

struct TranslateSessionCreateBody: Encodable {
    let subjectLanguage: String
    let vertical: String
    let campusContext: CampusCtx?
    let venueContext: VenueCtx?

    struct CampusCtx: Encodable {
        let campusCode: String
    }

    struct VenueCtx: Encodable {
        let venueCode: String
    }
}

struct TranslateCloseBody: Encodable {
    let writebackNote: Bool
}

extension RCAPIClient {
    func fetchTranslateLanguages() async throws -> [TranslateLanguageDTO] {
        let resp: TranslateLanguagesResponse = try await get(path: "/api/translate/languages")
        return resp.languages
    }

    func createTranslateSession(body: TranslateSessionCreateBody) async throws -> TranslateSessionDTO {
        let resp: TranslateCreateResponse = try await post(path: "/api/translate/sessions", body: body)
        return resp.session
    }

    func getTranslateWsToken(sessionId: String, role: String = "officer") async throws -> TranslateWsTokenResponse {
        let encoded = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        return try await get(
            path: "/api/translate/sessions/\(encoded)/ws-token?role=\(role)"
        )
    }

    func listTranslateSegments(sessionId: String) async throws -> [TranslateSegmentDTO] {
        let encoded = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        let resp: TranslateSegmentsResponse = try await get(
            path: "/api/translate/sessions/\(encoded)/segments"
        )
        return resp.items
    }

    func getTranslateSession(sessionId: String) async throws -> TranslateSessionDTO {
        let encoded = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        let resp: TranslateSessionResponse = try await get(
            path: "/api/translate/sessions/\(encoded)"
        )
        return resp.session
    }

    func closeTranslateSession(sessionId: String, writebackNote: Bool) async throws -> TranslateCloseResponse {
        let encoded = sessionId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? sessionId
        return try await post(
            path: "/api/translate/sessions/\(encoded)/close",
            body: TranslateCloseBody(writebackNote: writebackNote)
        )
    }
}
