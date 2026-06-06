import SwiftUI
import MapKit

/// Native MapKit hospital routing workspace (capacity + recommendations).
struct NativeHospitalMapView: View {
    @ObservedObject var viewModel: HospitalRoutingViewModel
    var showsCloseButton = true
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationSplitView {
            hospitalList
                .navigationSplitViewColumnWidth(min: 280, ideal: 320, max: 400)
        } detail: {
            mapPane
        }
        .navigationTitle("Hospital routing")
        .toolbar {
            if showsCloseButton {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await viewModel.loadRecommendations() }
                } label: {
                    if viewModel.isLoading {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                }
                .disabled(viewModel.isLoading)
            }
        }
        .task {
            await viewModel.loadRecommendations()
        }
    }

    private var mapPane: some View {
        ZStack(alignment: .bottomLeading) {
            Map(position: $viewModel.mapPosition, interactionModes: [.pan, .zoom]) {
                Annotation("Incident", coordinate: viewModel.incidentCoordinate) {
                    ZStack {
                        Circle()
                            .fill(.red.opacity(0.25))
                            .frame(width: 36, height: 36)
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
                    }
                }

                ForEach(viewModel.recommendations) { rec in
                    let level = MapRecommendationLevel(apiValue: rec.recommendation)
                    Annotation(rec.hospital.name, coordinate: rec.hospital.coordinates.coordinate) {
                        HospitalMapPin(
                            level: level,
                            isSelected: viewModel.selectedHospitalId == rec.hospitalId,
                            erAvailable: rec.capacity.availability.erBeds.available
                        )
                        .onTapGesture {
                            viewModel.selectHospital(rec.hospitalId)
                        }
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .mapControlVisibility(.visible)

            mapLegend
                .padding(12)
        }
    }

    private var mapLegend: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Apple Maps")
                .font(.caption.weight(.semibold))
            Label("Optimal", systemImage: "circle.fill")
                .foregroundStyle(.green)
                .font(.caption2)
            Label("Limited / diversion", systemImage: "circle.fill")
                .foregroundStyle(.red)
                .font(.caption2)
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
    }

    private var hospitalList: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Patient needs")
                    .font(.subheadline.weight(.semibold))
                Toggle("Trauma", isOn: $viewModel.needsTrauma)
                Toggle("Stroke", isOn: $viewModel.needsStroke)
                Toggle("STEMI", isOn: $viewModel.needsStemi)
                Divider()
                Text("Incident")
                    .font(.subheadline.weight(.semibold))
                HStack {
                    Text("Lat")
                    TextField("Latitude", value: latitudeBinding, format: .number)
                        .textFieldStyle(.roundedBorder)
                }
                HStack {
                    Text("Lon")
                    TextField("Longitude", value: longitudeBinding, format: .number)
                        .textFieldStyle(.roundedBorder)
                }
            }
            .padding()

            if let err = viewModel.errorMessage {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            List(viewModel.recommendations, selection: $viewModel.selectedHospitalId) { rec in
                HospitalListRow(
                    recommendation: rec,
                    isSelected: viewModel.selectedHospitalId == rec.hospitalId
                )
                .tag(rec.hospitalId as String?)
                .onTapGesture { viewModel.selectHospital(rec.hospitalId) }
            }
            .listStyle(.sidebar)
        }
    }

    private var latitudeBinding: Binding<Double> {
        Binding(
            get: { viewModel.incidentCoordinate.latitude },
            set: { viewModel.incidentCoordinate.latitude = $0 }
        )
    }

    private var longitudeBinding: Binding<Double> {
        Binding(
            get: { viewModel.incidentCoordinate.longitude },
            set: { viewModel.incidentCoordinate.longitude = $0 }
        )
    }
}

private struct HospitalMapPin: View {
    let level: MapRecommendationLevel
    let isSelected: Bool
    let erAvailable: Int

    var body: some View {
        ZStack {
            Circle()
                .fill(pinColor)
                .frame(width: isSelected ? 44 : 36, height: isSelected ? 44 : 36)
                .shadow(color: .black.opacity(0.35), radius: 4, y: 2)
            VStack(spacing: 0) {
                Image(systemName: "cross.case.fill")
                    .font(.caption.weight(.bold))
                Text("\(erAvailable)")
                    .font(.system(size: 9, weight: .bold))
            }
            .foregroundStyle(.white)
        }
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }

    private var pinColor: Color {
        switch level {
        case .optimal: .green
        case .acceptable: .orange
        case .suboptimal: .blue
        case .notRecommended: .red
        case .unknown: .gray
        }
    }
}

private struct HospitalListRow: View {
    let recommendation: HospitalRecommendationDTO
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(recommendation.hospital.name)
                    .font(.headline)
                    .lineLimit(2)
                Spacer()
                Text("\(recommendation.scoring.overallScore)")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(scoreColor)
            }
            Text(String(format: "%.1f mi · ~%d min", recommendation.routing.distanceMiles, recommendation.routing.durationLightsMinutes))
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Label("\(recommendation.capacity.availability.erBeds.available) ER", systemImage: "bed.double.fill")
                Label("\(recommendation.capacity.waitTimes.erWaitMinutes)m wait", systemImage: "clock")
            }
            .font(.caption2)
            if recommendation.capacity.diversion.isOnDiversion {
                Text("On diversion")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
        .padding(.horizontal, isSelected ? 4 : 0)
        .background(isSelected ? Color.accentColor.opacity(0.12) : Color.clear, in: RoundedRectangle(cornerRadius: 6))
    }

    private var scoreColor: Color {
        let s = recommendation.scoring.overallScore
        if s >= 80 { return .green }
        if s >= 60 { return .orange }
        return .red
    }
}
