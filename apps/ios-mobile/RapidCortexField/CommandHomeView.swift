import SwiftUI

@MainActor
final class CommandHomeViewModel: ObservableObject {
    @Published private(set) var stats = FieldCommandStats(activeCalls: 0, queue: 0, onlineCount: 0)
    @Published private(set) var assist: [FieldCommandIncident] = []
    @Published private(set) var incidents: [FieldCommandIncident] = []
    @Published private(set) var isLoading = false
    @Published var error: String?

    func load(agencyId: String) async {
        if incidents.isEmpty { isLoading = true }
        error = nil
        defer { isLoading = false }
        do {
            let home = try await RCAPIClient.shared.fieldCommandHome(agencyId: agencyId)
            stats = home.stats
            assist = home.assistRequests
            incidents = home.incidents
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct CommandHomeView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @StateObject private var vm = CommandHomeViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                if vm.isLoading && vm.incidents.isEmpty && vm.assist.isEmpty {
                    ProgressView().tint(RCTheme.danger)
                } else {
                    list
                }
            }
            .navigationTitle("Home")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(RCTheme.bg, for: .navigationBar)
            .navigationDestination(for: FieldCommandIncident.self) { incident in
                IncidentDetailView(incidentId: incident.incidentId, seed: incident)
            }
            .task {
                await vm.load(agencyId: auth.selectedAgencyId)
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 15_000_000_000)
                    await vm.load(agencyId: auth.selectedAgencyId)
                }
            }
            .refreshable { await vm.load(agencyId: auth.selectedAgencyId) }
        }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("View, communicate, and coach. This is not a dispatch console — no CAD write or close actions.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textSecondary)

                HStack(spacing: 10) {
                    commandStat(label: "Active calls", value: vm.stats.activeCalls)
                    commandStat(label: "Queue", value: vm.stats.queue)
                    commandStat(label: "Online", value: vm.stats.onlineCount)
                }

                if let error = vm.error, vm.incidents.isEmpty {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.danger)
                }

                if !vm.assist.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Supervisor assist")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(RCTheme.danger)
                            .textCase(.uppercase)
                        ForEach(vm.assist) { incident in
                            incidentCard(incident, assist: true)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Active incidents")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(RCTheme.textMuted)
                        .textCase(.uppercase)
                    if vm.incidents.isEmpty {
                        Text("No open incidents.")
                            .font(.system(size: 14))
                            .foregroundColor(RCTheme.textMuted)
                            .padding(.vertical, 24)
                            .frame(maxWidth: .infinity)
                    } else {
                        ForEach(vm.incidents) { incident in
                            incidentCard(incident, assist: incident.escalationFlag == true)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func commandStat(label: String, value: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(RCTheme.textMuted)
            Text("\(value)")
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(RCTheme.textPrimary)
                .monospacedDigit()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RCTheme.surface1)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
    }

    private func incidentCard(_ incident: FieldCommandIncident, assist: Bool) -> some View {
        Button {
            path.append(incident)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Circle()
                    .fill(urgencyColor(incident.urgency))
                    .frame(width: 10, height: 10)
                    .padding(.top, 6)
                VStack(alignment: .leading, spacing: 4) {
                    Text(incident.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(incident.location?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? incident.summary ?? incident.incidentId)
                        .font(.system(size: 12))
                        .foregroundColor(RCTheme.textSecondary)
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        Text(incident.urgency.uppercased())
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(urgencyColor(incident.urgency))
                        Text(incident.status.replacingOccurrences(of: "_", with: " "))
                            .font(.system(size: 10))
                            .foregroundColor(RCTheme.textMuted)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(RCTheme.textMuted)
            }
            .padding(14)
            .background(assist ? Color(hex: "#2A0808") : RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(assist ? RCTheme.danger.opacity(0.6) : RCTheme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func urgencyColor(_ urgency: String) -> Color {
        switch urgency.lowercased() {
        case "critical": return RCTheme.danger
        case "high": return RCTheme.warning
        case "moderate": return RCTheme.accentLight
        default: return RCTheme.textSecondary
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
