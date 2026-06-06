import Foundation
import CoreLocation

/// Mirrors `HospitalRecommendation` from `rapid-cortex-shared` (hospital routing API).
struct HospitalRecommendationDTO: Codable, Identifiable, Sendable {
    var id: String { hospitalId }
    let hospitalId: String
    let hospital: HospitalProfileDTO
    let capacity: HospitalCapacityDTO
    let routing: RoutingDTO
    let scoring: ScoringDTO
    let match: MatchDTO
    let recommendation: String
}

struct HospitalProfileDTO: Codable, Sendable {
    let hospitalId: String
    let agencyId: String
    let name: String
    let address: String
    let coordinates: CoordinatesDTO
    let phone: String
    let traumaLevel: String?
    let strokeCenter: Bool
    let cardiacCenter: Bool
    let pediatricCapable: Bool
    let burnCenter: Bool
}

struct CoordinatesDTO: Codable, Sendable {
    let latitude: Double
    let longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct HospitalCapacityDTO: Codable, Sendable {
    let timestamp: String
    let availability: AvailabilityDTO
    let waitTimes: WaitTimesDTO
    let diversion: DiversionDTO
}

struct AvailabilityDTO: Codable, Sendable {
    let erBeds: BedCountDTO
    let icuBeds: BedCountDTO
}

struct BedCountDTO: Codable, Sendable {
    let total: Int
    let occupied: Int
    let available: Int
}

struct WaitTimesDTO: Codable, Sendable {
    let erWaitMinutes: Int
}

struct DiversionDTO: Codable, Sendable {
    let isOnDiversion: Bool
    let diversionType: String?
    let diversionReason: String?
}

struct RoutingDTO: Codable, Sendable {
    let distanceMiles: Double
    let durationMinutes: Int
    let durationLightsMinutes: Int
}

struct ScoringDTO: Codable, Sendable {
    let overallScore: Int
}

struct MatchDTO: Codable, Sendable {
    let meetsRequirements: Bool
    let missingCapabilities: [String]
    let warnings: [String]
}

struct HospitalRecommendationsResponse: Codable, Sendable {
    let items: [HospitalRecommendationDTO]
}

struct HospitalRecommendationsRequest: Codable, Sendable {
    let latitude: Double
    let longitude: Double
    let patientNeeds: PatientNeedsDTO?
}

struct PatientNeedsDTO: Codable, Sendable {
    var trauma: Bool?
    var stroke: Bool?
    var stemi: Bool?
    var burn: Bool?
    var pediatric: Bool?
}

enum MapRecommendationLevel: String, Sendable {
    case optimal = "OPTIMAL"
    case acceptable = "ACCEPTABLE"
    case suboptimal = "SUBOPTIMAL"
    case notRecommended = "NOT_RECOMMENDED"
    case unknown

    init(apiValue: String) {
        self = MapRecommendationLevel(rawValue: apiValue) ?? .unknown
    }

    var pinColorName: String {
        switch self {
        case .optimal: "MapPinGreen"
        case .acceptable: "MapPinAmber"
        case .suboptimal: "MapPinOrange"
        case .notRecommended: "MapPinRed"
        case .unknown: "MapPinGray"
        }
    }
}
