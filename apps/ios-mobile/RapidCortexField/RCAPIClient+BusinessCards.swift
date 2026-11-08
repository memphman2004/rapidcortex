import Foundation

struct BusinessCardNfcCard: Identifiable, Decodable, Equatable, Hashable {
    var id: String { cardId }

    let cardId: String
    let tagType: String
    let status: String
    let permanentUrl: String
    let version: Int
    let assignedProfileId: String?
    let programmedAt: Double?
    let verifiedAt: Double?

    var isRevoked: Bool { status == "revoked" }

    var shortId: String {
        String(cardId.prefix(8))
    }

    var isPermanentNfcUrl: Bool {
        guard let url = URL(string: permanentUrl),
              url.scheme == "https",
              url.host == "www.nexcortiq.us"
        else { return false }
        let parts = url.path.split(separator: "/").map(String.init)
        return parts.count == 2 && parts[0] == "c" && !parts[1].isEmpty
    }
}

struct BusinessCardProfileSummary: Identifiable, Decodable, Equatable, Hashable {
    var id: String { profileId }

    let profileId: String
    let displayName: String
    let title: String?
    let status: String?
}

private struct BusinessCardNfcListResponse: Decodable {
    let items: [BusinessCardNfcCard]
}

private struct BusinessCardProfileListResponse: Decodable {
    let items: [BusinessCardProfileSummary]
}

private struct BusinessCardNfcStatusBody: Encodable {
    let status: String
    let version: Int
}

extension RCAPIClient {
    func listBusinessCardNfcCards() async throws -> [BusinessCardNfcCard] {
        let response: BusinessCardNfcListResponse = try await get(path: "/api/admin/nfc-cards")
        return response.items
    }

    func getBusinessCardNfcCard(cardId: String) async throws -> BusinessCardNfcCard {
        let encoded = cardId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? cardId
        return try await get(path: "/api/admin/nfc-cards/\(encoded)")
    }

    func listBusinessCardProfiles() async throws -> [BusinessCardProfileSummary] {
        let response: BusinessCardProfileListResponse = try await get(path: "/api/admin/business-cards")
        return response.items
    }

    func setBusinessCardNfcStatus(
        cardId: String,
        status: String,
        version: Int
    ) async throws -> BusinessCardNfcCard {
        let encoded = cardId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? cardId
        let body = BusinessCardNfcStatusBody(status: status, version: version)
        return try await patch(path: "/api/admin/nfc-cards/\(encoded)/status", body: body)
    }
}
