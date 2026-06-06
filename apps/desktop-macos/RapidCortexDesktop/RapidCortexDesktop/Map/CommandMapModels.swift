import CoreLocation
import Foundation

/// Map pin category — replace sample data with API-driven values later.
enum CommandMapAnnotationType: String, Codable, CaseIterable, Sendable {
    case incident
    case callerLocation
    case hospital
    case responder
}

enum CommandMapPriority: String, Codable, CaseIterable, Sendable {
    case critical
    case high
    case normal
    case low
}

/// Lightweight map entity for incident / caller / hospital / responder overlays.
struct CommandMapAnnotation: Identifiable, Equatable, Sendable {
    let id: String
    let title: String
    let subtitle: String
    let latitude: Double
    let longitude: Double
    let type: CommandMapAnnotationType
    let priority: CommandMapPriority

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

enum CommandMapSampleData {
    /// Columbus, Georgia — demo command-center scene for local development.
    static let columbusDemo: [CommandMapAnnotation] = [
        CommandMapAnnotation(
            id: "incident-1",
            title: "Active Incident",
            subtitle: "Structure fire · mutual aid requested",
            latitude: 32.460976,
            longitude: -84.987709,
            type: .incident,
            priority: .critical
        ),
        CommandMapAnnotation(
            id: "caller-1",
            title: "Caller LiveLocation",
            subtitle: "Pinpoint ping · high confidence",
            latitude: 32.468120,
            longitude: -84.995320,
            type: .callerLocation,
            priority: .high
        ),
        CommandMapAnnotation(
            id: "hospital-1",
            title: "Nearest Hospital",
            subtitle: "ER capacity available · trauma center",
            latitude: 32.481000,
            longitude: -84.983000,
            type: .hospital,
            priority: .normal
        ),
        CommandMapAnnotation(
            id: "unit-1",
            title: "Responder Unit",
            subtitle: "Medic 12 · en route",
            latitude: 32.455500,
            longitude: -84.973200,
            type: .responder,
            priority: .high
        ),
    ]
}
