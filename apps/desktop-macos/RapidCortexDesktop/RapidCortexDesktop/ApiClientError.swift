import Foundation

enum ApiClientError: LocalizedError {
    case http(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case let .http(status, body):
            let snippet = body.prefix(200)
            return "API error \(status): \(snippet)"
        }
    }
}
