import BigInt
import CryptoKit
import Foundation
import Security

/// Cognito USER_SRP_AUTH (SRP-6a) matching amazon-cognito-identity-js / Amplify Auth.
final class CognitoSRPHelper {
    private let username: String
    private let password: String
    private let poolName: String
    private let smallA: BigUInt
    private let largeA: BigUInt
    private let N: BigUInt
    private let g: BigUInt
    private let k: BigUInt

    /// RFC 5054 3072-bit group used by Cognito.
    private static let nHex = """
    FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74\
    020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437\
    4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED\
    EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05\
    98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB\
    9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B\
    E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718\
    3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33\
    A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7\
    ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864\
    D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2\
    08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF
    """

    init(username: String, password: String, userPoolId: String) {
        self.username = username
        self.password = password
        let parts = userPoolId.split(separator: "_", maxSplits: 1)
        self.poolName = parts.count == 2 ? String(parts[1]) : userPoolId

        guard let n = BigUInt(Self.nHex, radix: 16) else {
            preconditionFailure("Invalid Cognito SRP modulus")
        }
        self.N = n
        self.g = BigUInt(2)

        var random = Data(count: 128)
        _ = random.withUnsafeMutableBytes { buf in
            SecRandomCopyBytes(kSecRandomDefault, 128, buf.baseAddress!)
        }
        self.smallA = BigUInt(random) % n
        self.largeA = self.g.power(self.smallA, modulus: n)
        self.k = BigUInt(Self.hexHash(Self.padHex(n) + Self.padHex(self.g)), radix: 16) ?? BigUInt(0)
    }

    func initiate() -> (srpA: String, username: String) {
        (String(largeA, radix: 16), username)
    }

    func respondToChallenge(params: [String: String]) throws -> [String: String] {
        guard let secretBlock = params["SECRET_BLOCK"],
              let srpBHex = params["SRP_B"],
              let saltHex = params["SALT"],
              let srpUsername = params["USER_ID_FOR_SRP"],
              let serverB = BigUInt(srpBHex, radix: 16),
              let salt = BigUInt(saltHex, radix: 16)
        else {
            throw AuthError.unexpectedChallenge
        }

        if serverB % N == 0 {
            throw AuthError.cognitoError("Invalid SRP parameter B.")
        }

        let u = calculateU(A: largeA, B: serverB)
        if u == 0 {
            throw AuthError.cognitoError("Invalid SRP parameter U.")
        }

        let hkdf = try passwordAuthenticationKey(
            srpUsername: srpUsername,
            serverB: serverB,
            salt: salt,
            u: u
        )

        let timestamp = Self.srpTimestamp()
        let signature = try Self.claimSignature(
            hkdf: hkdf,
            poolName: poolName,
            username: srpUsername,
            secretBlock: secretBlock,
            timestamp: timestamp
        )

        return [
            "USERNAME": srpUsername,
            "PASSWORD_CLAIM_SECRET_BLOCK": secretBlock,
            "PASSWORD_CLAIM_SIGNATURE": signature,
            "TIMESTAMP": timestamp
        ]
    }

    // MARK: - SRP math

    private func calculateU(A: BigUInt, B: BigUInt) -> BigUInt {
        BigUInt(Self.hexHash(Self.padHex(A) + Self.padHex(B)), radix: 16) ?? 0
    }

    private func passwordAuthenticationKey(
        srpUsername: String,
        serverB: BigUInt,
        salt: BigUInt,
        u: BigUInt
    ) throws -> Data {
        let userPass = "\(poolName)\(srpUsername):\(password)"
        let userPassHash = Self.hashHex(Data(userPass.utf8))
        let xHex = Self.hexHash(Self.padHex(salt) + userPassHash)
        guard let x = BigUInt(xHex, radix: 16) else {
            throw AuthError.cognitoError("SRP x computation failed.")
        }

        let gModPowXN = g.power(x, modulus: N)
        let kx = (k * gModPowXN) % N
        let base = Self.mod(BigInt(serverB) - BigInt(kx), N)
        let exp = smallA + u * x
        let s = base.power(exp, modulus: N)

        guard let ikm = Data(hex: Self.padHex(s)),
              let saltData = Data(hex: Self.padHex(u))
        else {
            throw AuthError.cognitoError("SRP HKDF input encoding failed.")
        }
        return Self.computeHKDF(ikm: ikm, salt: saltData)
    }

    private static func computeHKDF(ikm: Data, salt: Data) -> Data {
        let prk = Data(HMAC<SHA256>.authenticationCode(for: ikm, using: SymmetricKey(data: salt)))
        var info = Data("Caldera Derived Key".utf8)
        info.append(1)
        let okm = Data(HMAC<SHA256>.authenticationCode(for: info, using: SymmetricKey(data: prk)))
        return okm.prefix(16)
    }

    private static func claimSignature(
        hkdf: Data,
        poolName: String,
        username: String,
        secretBlock: String,
        timestamp: String
    ) throws -> String {
        guard let secretData = Data(base64Encoded: secretBlock) else {
            throw AuthError.unexpectedChallenge
        }
        var message = Data(poolName.utf8)
        message.append(Data(username.utf8))
        message.append(secretData)
        message.append(Data(timestamp.utf8))
        let mac = HMAC<SHA256>.authenticationCode(for: message, using: SymmetricKey(data: hkdf))
        return Data(mac).base64EncodedString()
    }

    /// Cognito padHex: even-length hex; prefix `00` when the high nibble is 8–F.
    static func padHex(_ value: BigUInt) -> String {
        var hashStr = String(value, radix: 16)
        if hashStr.count % 2 == 1 {
            hashStr = "0" + hashStr
        } else if let first = hashStr.first, "89ABCDEFabcdef".contains(first) {
            hashStr = "00" + hashStr
        }
        return hashStr
    }

    private static func hashHex(_ data: Data) -> String {
        let hex = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let pad = String(repeating: "0", count: max(0, 64 - hex.count))
        return pad + hex
    }

    private static func hexHash(_ hex: String) -> String {
        hashHex(Data(hex: hex) ?? Data())
    }

    /// `EEE MMM d HH:mm:ss UTC yyyy` with unpadded day and padded time (Amplify dateHelper).
    static func srpTimestamp(_ date: Date = Date()) -> String {
        let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let n = date
        let weekday = calendar.component(.weekday, from: n) - 1
        let month = calendar.component(.month, from: n) - 1
        let day = calendar.component(.day, from: n)
        let hour = calendar.component(.hour, from: n)
        let minute = calendar.component(.minute, from: n)
        let second = calendar.component(.second, from: n)
        let year = calendar.component(.year, from: n)
        return String(
            format: "%@ %@ %d %02d:%02d:%02d UTC %d",
            days[weekday], months[month], day, hour, minute, second, year
        )
    }

    private static func mod(_ value: BigInt, _ modulus: BigUInt) -> BigUInt {
        let m = BigInt(modulus)
        var r = value % m
        if r < 0 { r += m }
        return BigUInt(r)
    }
}

extension Data {
    init?(hex: String) {
        let cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleaned.count % 2 == 0, !cleaned.isEmpty else { return nil }
        var data = Data(capacity: cleaned.count / 2)
        var index = cleaned.startIndex
        while index < cleaned.endIndex {
            let next = cleaned.index(index, offsetBy: 2)
            guard let byte = UInt8(cleaned[index..<next], radix: 16) else { return nil }
            data.append(byte)
            index = next
        }
        self = data
    }
}
