import MapKit
import SwiftUI

struct RapidCortexMapView: View {
    @ObservedObject var viewModel: CommandMapViewModel

    var body: some View {
        VStack(spacing: 0) {
            header
            mapPane
        }
        .frame(minWidth: 900, minHeight: 600)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Rapid Cortex Command Map")
                    .font(.title2.weight(.semibold))
                Text("LiveLocation, responder awareness, hospital context, and incident mapping.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 12)

            HStack(spacing: 10) {
                legendChip
                Button("Center Incident", action: viewModel.centerOnIncident)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(.regularMaterial)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private var legendChip: some View {
        HStack(spacing: 12) {
            legendDot(color: .red, label: "Incident")
            legendDot(color: .orange, label: "Caller")
            legendDot(color: .blue, label: "Hospital")
            legendDot(color: .green, label: "Unit")
        }
        .font(.caption)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.quaternary.opacity(0.6), in: Capsule())
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }

    private var mapPane: some View {
        Map(position: $viewModel.mapPosition) {
            ForEach(viewModel.annotations) { item in
                Marker(item.title, coordinate: item.coordinate)
                    .tint(tint(for: item.type))
            }
        }
        .mapStyle(.standard(elevation: .realistic))
        .mapControls {
            MapCompass()
            MapScaleView()
            MapPitchToggle()
        }
    }

    private func tint(for type: CommandMapAnnotationType) -> Color {
        switch type {
        case .incident: .red
        case .callerLocation: .orange
        case .hospital: .blue
        case .responder: .green
        }
    }
}

#Preview {
    RapidCortexMapView(viewModel: CommandMapViewModel())
        .frame(width: 960, height: 640)
}
