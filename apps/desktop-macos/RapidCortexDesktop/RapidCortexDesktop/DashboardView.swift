import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var network: NetworkPathMonitor
    @State private var healthStatus = "—"
    @State private var meStatus = "—"
    @State private var isPinging = false
    @State private var didRunInitialCheck = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Dashboard")
                    .font(.title2.weight(.semibold))
                Spacer()
                connectivityChip
            }

            Text("You are signed in. Tokens are stored in the Keychain. Use the checks below to verify API connectivity and JWT acceptance.")
                .foregroundStyle(.secondary)

            GroupBox("API health (unauthenticated)") {
                VStack(alignment: .leading, spacing: 8) {
                    Text(healthStatus).font(.body.monospaced()).textSelection(.enabled)
                    HStack {
                        Button("Ping GET /api/health") {
                            Task { await pingHealthOnly() }
                        }
                        .disabled(isPinging)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            GroupBox("Session (authenticated)") {
                VStack(alignment: .leading, spacing: 8) {
                    Text(meStatus).font(.body.monospaced()).textSelection(.enabled)
                    HStack {
                        Button("Validate GET /api/me") {
                            Task { await pingMe() }
                        }
                        .disabled(isPinging || session.idTokenForApi() == nil)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if isPinging { ProgressView("Checking API…").controlSize(.small) }

            Spacer()
        }
        .padding()
        .onAppear {
            if !didRunInitialCheck {
                didRunInitialCheck = true
                Task { await runInitialApiChecks() }
            }
        }
    }

    private var connectivityChip: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(network.isOnline ? Color.green : Color.orange)
                .frame(width: 8, height: 8)
            Text(network.isOnline ? "Online" : "Offline / constrained")
                .font(.caption)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(.thinMaterial, in: Capsule())
    }

    private func runInitialApiChecks() async {
        await pingHealthOnly()
        if session.idTokenForApi() != nil {
            await pingMe()
        } else {
            meStatus = "No id_token in Keychain."
        }
    }

    private func pingHealthOnly() async {
        isPinging = true
        defer { isPinging = false }
        let client = ApiClient(configuration: session.configuration) { nil }
        do {
            let r = try await client.pingHealth()
            healthStatus = "HTTP \(r.status)\n\(r.body.prefix(2000))"
        } catch let url as URLError {
            healthStatus = "Network error: \(url.localizedDescription) (code \(url.code.rawValue)). Check API base URL, VPN, and that the service is up."
        } catch {
            healthStatus = "Error: \(error.localizedDescription)"
        }
    }

    private func pingMe() async {
        isPinging = true
        defer { isPinging = false }
        let idToken = session.idTokenForApi()
        let client = ApiClient(configuration: session.configuration) { idToken }
        do {
            let r = try await client.fetchMe()
            if r.status == 401 {
                meStatus = "HTTP 401 — id_token invalid or expired. Sign out and sign in again."
            } else {
                meStatus = "HTTP \(r.status)\n\(r.body.prefix(2000))"
            }
        } catch let url as URLError {
            meStatus = "Network error: \(url.localizedDescription)"
        } catch {
            meStatus = "Error: \(error.localizedDescription)"
        }
    }
}
