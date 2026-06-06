import Foundation
import CoreLocation
import MapKit
import SwiftUI

@MainActor
final class HospitalRoutingViewModel: ObservableObject {
    @Published var incidentCoordinate = CLLocationCoordinate2D(latitude: 27.3364, longitude: -82.5306)
    @Published var recommendations: [HospitalRecommendationDTO] = []
    @Published var selectedHospitalId: String?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var needsTrauma = false
    @Published var needsStroke = false
    @Published var needsStemi = false

    @Published var mapPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 27.3364, longitude: -82.5306),
            span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
        )
    )

    private let api: ApiClient

    init(api: ApiClient) {
        self.api = api
    }

    func loadRecommendations() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let needs = PatientNeedsDTO(
            trauma: needsTrauma ? true : nil,
            stroke: needsStroke ? true : nil,
            stemi: needsStemi ? true : nil,
            burn: nil,
            pediatric: nil
        )

        do {
            let items = try await api.fetchHospitalRecommendations(
                latitude: incidentCoordinate.latitude,
                longitude: incidentCoordinate.longitude,
                patientNeeds: needs
            )
            recommendations = items
            centerMapOnIncident()
        } catch {
            errorMessage = error.localizedDescription
            recommendations = []
        }
    }

    func centerMapOnIncident() {
        mapPosition = .region(
            MKCoordinateRegion(
                center: incidentCoordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.12, longitudeDelta: 0.12)
            )
        )
    }

    func selectHospital(_ id: String?) {
        selectedHospitalId = id
        guard let id,
              let rec = recommendations.first(where: { $0.hospitalId == id }) else { return }
        let c = rec.hospital.coordinates.coordinate
        mapPosition = .region(
            MKCoordinateRegion(
                center: c,
                span: MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.04)
            )
        )
    }

    var selectedRecommendation: HospitalRecommendationDTO? {
        guard let selectedHospitalId else { return nil }
        return recommendations.first { $0.hospitalId == selectedHospitalId }
    }
}
