import CoreLocation
import MapKit
import SwiftUI

@MainActor
final class CommandMapViewModel: ObservableObject {
    static let defaultIncidentCoordinate = CLLocationCoordinate2D(latitude: 32.460976, longitude: -84.987709)

    @Published var mapPosition: MapCameraPosition
    @Published private(set) var annotations: [CommandMapAnnotation]

    let incidentCoordinate: CLLocationCoordinate2D

    init(annotations: [CommandMapAnnotation] = CommandMapSampleData.columbusDemo) {
        self.annotations = annotations
        incidentCoordinate =
            annotations.first(where: { $0.type == .incident })?.coordinate
            ?? Self.defaultIncidentCoordinate
        mapPosition = .region(
            MKCoordinateRegion(
                center: incidentCoordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
            )
        )
    }

    func replaceAnnotations(_ next: [CommandMapAnnotation]) {
        annotations = next
        if let incident = next.first(where: { $0.type == .incident }) {
            centerOnCoordinate(incident.coordinate, span: 0.05)
        }
    }

    func centerOnIncident() {
        centerOnCoordinate(incidentCoordinate, span: 0.05)
    }

    private func centerOnCoordinate(_ coordinate: CLLocationCoordinate2D, span: Double) {
        mapPosition = .region(
            MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span)
            )
        )
    }
}
