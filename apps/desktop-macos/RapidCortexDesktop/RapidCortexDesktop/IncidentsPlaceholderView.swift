import SwiftUI

struct IncidentsPlaceholderView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var network: NetworkPathMonitor
    @State private var preview = "Tap “Fetch preview” to call GET /api/incidents (raw body, Phase 1)."
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Incidents")
                    .font(.title2.weight(.semibold))
                Spacer()
                HStack(spacing: 6) {
                    Circle()
                        .fill(network.isOnline ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                    Text(network.isOnline ? "Online" : "Offline")
                        .font(.caption)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(.thinMaterial, in: Capsule())
            }

            Text("Placeholder list — JSON mapping ships in a later phase. Contract: `apps/web/lib/api.ts` → `fetchIncidents`.")
                .foregroundStyle(.secondary)

            Button("Fetch preview (authorized)") {
                Task { await load() }
            }
            .disabled(isLoading || session.idTokenForApi() == nil)

            ScrollView {
                Text(preview)
                    .font(.body.monospaced())
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .overlay {
                if isLoading { ProgressView() }
            }
        }
        .padding()
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        let idToken = session.idTokenForApi()
        let client = ApiClient(configuration: session.configuration) { idToken }
        do {
            let r = try await client.fetchIncidentsPreview()
            preview = "HTTP \(r.status)\n\(r.body.prefix(8000))"
        } catch {
            preview = "Error: \(error.localizedDescription)"
        }
    }
}
