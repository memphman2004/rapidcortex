import Foundation
import Security

/// Stores Cognito **id_token** (and optional refresh token) in the login keychain. Phase 1 — review keychain ACL for your org.
enum KeychainTokenStore {
    private static let service = "com.rapidcortex.desktop.auth"
    private static let idTokenAccount = "id_token"
    private static let accessTokenAccount = "access_token"
    private static let refreshTokenAccount = "refresh_token"
    private static let accessTokenExpiryAccount = "access_token_expires_at"

    static func saveIdToken(_ value: String) throws {
        try save(account: idTokenAccount, value: value)
    }

    static func idToken() -> String? {
        load(account: idTokenAccount)
    }

    static func saveRefreshToken(_ value: String) throws {
        try save(account: refreshTokenAccount, value: value)
    }

    static func refreshToken() -> String? {
        load(account: refreshTokenAccount)
    }

    static func saveAccessToken(_ value: String) throws {
        try save(account: accessTokenAccount, value: value)
    }

    static func accessToken() -> String? {
        load(account: accessTokenAccount)
    }

    static func saveAccessTokenExpiry(_ date: Date) throws {
        try save(account: accessTokenExpiryAccount, value: String(Int(date.timeIntervalSince1970)))
    }

    static func accessTokenExpiry() -> Date? {
        guard let value = load(account: accessTokenExpiryAccount), let epoch = TimeInterval(value) else { return nil }
        return Date(timeIntervalSince1970: epoch)
    }

    static func clearAll() throws {
        try delete(account: idTokenAccount)
        try delete(account: accessTokenAccount)
        try delete(account: refreshTokenAccount)
        try delete(account: accessTokenExpiryAccount)
    }

    private static func save(account: String, value: String) throws {
        let data = Data(value.utf8)
        try delete(account: account)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.osStatus(status) }
    }

    private static func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func delete(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }

    enum KeychainError: Error {
        case osStatus(OSStatus)
    }
}
