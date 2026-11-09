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
    var latitude: Double?
    var longitude: Double?
    var locationAccuracyMeters: Double?
    var locationSource: String?
    var locationVerified: Bool
    var locationVerifiedAt: String?
    var locationVerifiedBy: String?
    var floorLevel: String?

    var isNfcProgrammed: Bool { !nfcWriteLog.isEmpty }
    var hasRegisteredCoordinates: Bool { latitude != nil && longitude != nil }

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
            floor: dto.floorLevel,
            zone: dto.zone,
            zoneCode: nil,
            smsNumber: dto.smsNumber,
            nfcWriteLog: dto.nfcWriteLog ?? [],
            lastActivityAt: dto.metrics?.lastNfcTap ?? dto.metrics?.lastQrScan,
            latitude: dto.latitude,
            longitude: dto.longitude,
            locationAccuracyMeters: dto.locationAccuracyMeters,
            locationSource: dto.locationSource,
            locationVerified: dto.locationVerified ?? false,
            locationVerifiedAt: dto.locationVerifiedAt,
            locationVerifiedBy: dto.locationVerifiedBy,
            floorLevel: dto.floorLevel
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

    /// Tenant users — avoid GET /api/agencies/{id}, which 401s native tokens on the primary API.
    init(from claims: RCUserClaims) {
        self.agencyId = claims.agencyId
        self.name = claims.agencyId
        self.vertical = claims.agencyVertical ?? claims.qrCodeVertical
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
    /// Cognito `custom:agencyVertical` (falls back to `custom:vertical`). Never shown in UI.
    let agencyVertical: String?

    var canonicalRole: String { RoleNormalization.canonicalize(role) }

    /// Product suffix stripped (`campus_admin_highered` → `campus_admin`) for routing / capability gates.
    var routingRole: String { RoleNormalization.routingRole(canonicalRole) }

    /// Value sent to the codes API — not a user-facing label.
    var qrCodeVertical: String {
        let v = (agencyVertical ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if v == "campus" || v == "venue" || v == "transit" { return v }
        if canonicalRole.hasPrefix("campus_") { return "campus" }
        if canonicalRole.hasPrefix("transit_") { return "transit" }
        return "venue"
    }

    var isPlatformAdmin: Bool {
        ["rcsuperadmin", "rcadmin", "rcitadmin"].contains(canonicalRole)
    }

    /// NexCort iQ staff (RC + sales) may program the NFC tag on their own business card.
    var canManageBusinessCardNfc: Bool {
        ["rcsuperadmin", "rcadmin", "rcitadmin", "salescontractor"].contains(canonicalRole)
    }

    var isNexCortEmployee: Bool { canManageBusinessCardNfc }

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
        ].contains(routingRole)
    }

    var canManageCodes: Bool { isPlatformAdmin || isAgencyAdmin }

    /// Field Translator is available to every signed-in account.
    var canStartTranslate: Bool { true }

    /// Supervisor-tier actions in 911 Dispatch (message, coach, flag, follow, log). View-only roles omit these.
    var canActInDispatch911: Bool {
        ["supervisor", "agencyadmin", "rcsuperadmin", "rcadmin"].contains(canonicalRole)
    }

    var roleLabel: String {
        switch canonicalRole {
        case "supervisor": return "Supervisor"
        case "dispatcher": return "Dispatcher"
        case "agencyadmin": return "Agency Admin"
        case "agencyit": return "Agency IT"
        case "analyst": return "Analyst"
        case "auditor": return "Auditor"
        case "rcsuperadmin", "rcadmin": return "NC Admin"
        case "rcitadmin": return "NC IT"
        default:
            return canonicalRole.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

enum RoleNormalization {
    /// Align with `packages/shared` migrateLegacyRapidCortexRoleTokenValue for campus product suffixes.
    static func canonicalize(_ role: String) -> String {
        let raw = role.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "" }
        let upper = raw.uppercased()
        let screaming: [String: String] = [
            // Campus product-suffixed Cognito groups (K-12 vs Higher-ed).
            "CAMPUS_ADMIN_K12": "campus_admin_k12",
            "CAMPUS_ADMIN_HIGHERED": "campus_admin_highered",
            "CAMPUS_SUPERVISOR_K12": "campus_supervisor_k12",
            "CAMPUS_SUPERVISOR_HIGHERED": "campus_supervisor_highered",
            "CAMPUS_SECURITY_K12": "campus_security_k12",
            "CAMPUS_SECURITY_HIGHERED": "campus_security_highered",
            "CAMPUS_DISPATCH_K12": "campus_dispatch_k12",
            "CAMPUS_DISPATCH_HIGHERED": "campus_dispatch_highered",
            "CAMPUS_COUNSELOR_K12": "campus_counselor_k12",
            "CAMPUS_COUNSELOR_HIGHERED": "campus_counselor_highered",
            "CAMPUS_FACULTY_K12": "campus_faculty_k12",
            "CAMPUS_FACULTY_HIGHERED": "campus_faculty_highered",
            // Legacy unsuffixed campus → K-12 (web default); mobile routing strips suffix.
            "CAMPUS_ADMIN": "campus_admin_k12",
            "CAMPUS_SUPERVISOR": "campus_supervisor_k12",
            "CAMPUS_SECURITY": "campus_security_k12",
            "CAMPUS_DISPATCH": "campus_dispatch_k12",
            "CAMPUS_COUNSELOR": "campus_counselor_k12",
            "CAMPUS_FACULTY": "campus_faculty_k12",
            "VENUE_ADMIN": "venue_admin",
            "VENUE_SUPERVISOR": "venue_supervisor",
            "VENUE_SECURITY": "venue_security",
            "VENUE_OPERATOR": "venue_operator",
            "VENUE_GUEST": "venue_guest_services",
            "VENUE_GUEST_SERVICES": "venue_guest_services",
            "TRANSIT_ADMIN": "transit_admin",
            "TRANSIT_SUPERVISOR": "transit_supervisor",
            "TRANSIT_SECURITY": "transit_security",
            "TRANSIT_OPERATOR": "transit_operator"
        ]
        let normalized = raw.lowercased().replacingOccurrences(of: "-", with: "_")
        // Legacy Cognito value — not a product role. Always treat as supervisor.
        if normalized == "commsupervisor" { return "supervisor" }
        if let mapped = screaming[upper] { return mapped }
        // Compact aliases used in older seeds.
        let aliases: [String: String] = [
            "campusadmin": "campus_admin_k12",
            "campussupervisor": "campus_supervisor_k12",
            "campussecurity": "campus_security_k12",
            "campusdispatch": "campus_dispatch_k12"
        ]
        if let aliased = aliases[normalized] { return aliased }
        // Legacy snake_case without product suffix → K-12.
        switch normalized {
        case "campus_admin": return "campus_admin_k12"
        case "campus_supervisor": return "campus_supervisor_k12"
        case "campus_security": return "campus_security_k12"
        case "campus_dispatch": return "campus_dispatch_k12"
        case "campus_counselor": return "campus_counselor_k12"
        case "campus_faculty": return "campus_faculty_k12"
        default: return normalized
        }
    }

    /// Strip `_k12` / `_highered` so routers and capability lists stay product-agnostic.
    static func routingRole(_ canonical: String) -> String {
        if canonical.hasSuffix("_highered") {
            return String(canonical.dropLast("_highered".count))
        }
        if canonical.hasSuffix("_k12") {
            return String(canonical.dropLast("_k12".count))
        }
        return canonical
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
    let latitude: Double?
    let longitude: Double?
    let locationAccuracyMeters: Double?
    let locationSource: String?
    let locationVerified: Bool?
    let locationVerifiedAt: String?
    let locationVerifiedBy: String?
    let floorLevel: String?
    let createdAt: String?
    let updatedAt: String?
}

struct UpdateCodeLocationRequest: Encodable {
    let latitude: Double?
    let longitude: Double?
    let locationAccuracyMeters: Double?
    let locationSource: String?
    let altitudeMeters: Double?
    let markLocationVerified: Bool?
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
