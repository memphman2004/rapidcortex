import Foundation

struct QRNFCCode: Identifiable, Codable, Equatable, Hashable {
    var id: String { qrId }

    let qrId: String
    let agencyId: String
    let agencyName: String
    let name: String
    let vertical: String
    let reportType: String
    var nfcEnabled: Bool
    var active: Bool
    let url: String
    var scanCount: Int
    var nfcTapCount: Int
    var totalEngagements: Int
    let createdBy: String
    let createdByRole: String
    let createdAt: String
    var updatedAt: String
    var locationName: String?
    var building: String?
    var floor: String?
    var zone: String?
    var zoneCode: String?
    var smsNumber: String?
    var nfcWriteLog: [NFCWriteEvent]
    var lastActivityAt: String?

    var isNfcProgrammed: Bool { !nfcWriteLog.isEmpty }

    static func fromLiveCode(_ dto: RCCodeDTO) -> QRNFCCode {
        let scans = dto.metrics?.qrScans ?? 0
        let taps = dto.metrics?.nfcTaps ?? 0
        let url = dto.reportUrl ?? dto.nfcUrl ?? ""
        return QRNFCCode(
            qrId: dto.codeId,
            agencyId: dto.agencyId,
            agencyName: "",
            name: dto.name,
            vertical: dto.vertical,
            reportType: dto.reportType,
            nfcEnabled: !(dto.nfcUrl ?? "").isEmpty || !(dto.reportUrl ?? "").isEmpty,
            active: (dto.status ?? "active") == "active",
            url: url,
            scanCount: scans,
            nfcTapCount: taps,
            totalEngagements: scans + taps,
            createdBy: "",
            createdByRole: "",
            createdAt: dto.createdAt ?? "",
            updatedAt: dto.updatedAt ?? "",
            locationName: dto.name,
            building: nil,
            floor: nil,
            zone: dto.zone,
            zoneCode: nil,
            smsNumber: dto.smsNumber,
            nfcWriteLog: dto.nfcWriteLog ?? [],
            lastActivityAt: dto.metrics?.lastNfcTap ?? dto.metrics?.lastQrScan
        )
    }
}

struct NewQRNFCCodeRequest: Encodable {
    let agencyId: String
    let name: String
    let zone: String
    let reportType: String
    let vertical: String
    let smsNumber: String?
}

struct Agency: Identifiable, Codable, Equatable, Hashable {
    var id: String { agencyId }

    let agencyId: String
    let name: String
    var vertical: String
    var active: Bool
    var codeCount: Int?
    var planTier: String?
    var logoUrl: String?

    init(agencyId: String, name: String, vertical: String, active: Bool, codeCount: Int? = nil, planTier: String? = nil, logoUrl: String? = nil) {
        self.agencyId = agencyId
        self.name = name
        self.vertical = vertical
        self.active = active
        self.codeCount = codeCount
        self.planTier = planTier
        self.logoUrl = logoUrl
    }

    init(from dto: AgencyDTO) {
        let status = (dto.status ?? "active").lowercased()
        self.agencyId = dto.agencyId
        self.name = dto.name ?? dto.agencyId
        self.vertical = dto.vertical ?? dto.type ?? ""
        self.active = status == "active" || status == "pilot"
        self.codeCount = nil
        self.planTier = dto.planTier
        self.logoUrl = dto.config?.branding?.logoUrl
    }

    /// Tenant users (campus/venue) — avoid GET /api/agencies/{id}, which 401s native tokens on the primary API.
    init(from claims: RCUserClaims) {
        self.agencyId = claims.agencyId
        self.name = claims.agencyId
        let role = claims.canonicalRole
        if role.contains("campus") {
            self.vertical = "campus"
        } else if role.contains("venue") {
            self.vertical = "venue"
        } else if role.contains("transit") {
            self.vertical = "transit"
        } else {
            self.vertical = ""
        }
        self.active = true
        self.codeCount = nil
        self.planTier = nil
        self.logoUrl = nil
    }
}

struct RCUserClaims {
    let email: String
    let role: String
    let agencyId: String
    let sub: String

    var canonicalRole: String { RoleNormalization.canonicalize(role) }

    var isPlatformAdmin: Bool {
        ["rcsuperadmin", "rcadmin", "rcitadmin"].contains(canonicalRole)
    }

    var isAgencyAdmin: Bool {
        [
            "agencyadmin",
            "agencyit",
            "campus_admin",
            "campus_supervisor",
            "venue_admin",
            "venue_supervisor",
            "venue_operator",
            "transit_admin",
            "transit_supervisor"
        ].contains(canonicalRole)
    }

    var canManageCodes: Bool { isPlatformAdmin || isAgencyAdmin }

    var roleLabel: String {
        canonicalRole.replacingOccurrences(of: "_", with: " ").uppercased()
    }
}

enum RoleNormalization {
    static func canonicalize(_ role: String) -> String {
        let raw = role.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "" }
        let screaming: [String: String] = [
            "CAMPUS_ADMIN": "campus_admin",
            "CAMPUS_SUPERVISOR": "campus_supervisor",
            "CAMPUS_SECURITY": "campus_security",
            "CAMPUS_DISPATCH": "campus_security",
            "VENUE_ADMIN": "venue_admin",
            "VENUE_SUPERVISOR": "venue_supervisor",
            "VENUE_SECURITY": "venue_security",
            "VENUE_OPERATOR": "venue_operator",
            "TRANSIT_ADMIN": "transit_admin",
            "TRANSIT_SUPERVISOR": "transit_supervisor",
            "TRANSIT_SECURITY": "transit_security",
            "TRANSIT_OPERATOR": "transit_operator"
        ]
        if let mapped = screaming[raw.uppercased()] { return mapped }
        return raw.lowercased().replacingOccurrences(of: "-", with: "_")
    }
}

struct RCListResponse<T: Codable>: Codable {
    let items: [T]
    let count: Int?
    var nextToken: String?
}

struct RCCodeDTO: Codable {
    let codeId: String
    let agencyId: String
    let name: String
    let zone: String?
    let reportType: String
    let vertical: String
    let smsNumber: String?
    let reportUrl: String?
    let nfcUrl: String?
    let status: String?
    let metrics: RCCodeMetricsDTO?
    let nfcWriteLog: [NFCWriteEvent]?
    let createdAt: String?
    let updatedAt: String?
}

struct RCCodeMetricsDTO: Codable {
    let nfcTaps: Int?
    let qrScans: Int?
    let lastNfcTap: String?
    let lastQrScan: String?
}

struct NFCWriteEvent: Codable, Equatable, Hashable {
    let eventId: String?
    let writtenBy: String?
    let writtenByName: String?
    let devicePlatform: String?
    let bytesWritten: Int?
    let writtenAt: String?
}

struct AgencyDTO: Codable {
    let agencyId: String
    let name: String?
    let vertical: String?
    let type: String?
    let status: String?
    let planTier: String?
    let config: AgencyConfigDTO?
}

struct AgencyConfigDTO: Codable {
    let branding: AgencyBrandingDTO?
}

struct AgencyBrandingDTO: Codable {
    let logoUrl: String?
}

struct MobileEnvelope<T: Decodable>: Decodable {
    let success: Bool?
    let data: T?
    let error: String?
}

struct CodesListPayload: Decodable {
    let codes: [RCCodeDTO]
}

struct CodePayload: Decodable {
    let code: RCCodeDTO
}

enum NFCWriteResult {
    case success(bytesWritten: Int)
    case failure(error: Error)
    case cancelled
}
