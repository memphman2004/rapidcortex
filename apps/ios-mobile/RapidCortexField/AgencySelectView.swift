import SwiftUI

/// RC platform admins choose an agency by name. No operational-profile labels.
@MainActor
final class AgencySelectViewModel: ObservableObject {
    @Published private(set) var agencies: [Agency] = []
    @Published private(set) var isLoading = false
    @Published var error: String?

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            agencies = try await RCAPIClient.shared.listAgencies().sorted { a, b in
                if a.agencyId == RCConfig.testAgencyId { return true }
                if b.agencyId == RCConfig.testAgencyId { return false }
                return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
            }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct AgencySelectView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @StateObject private var vm = AgencySelectViewModel()
    @State private var search = ""

    private var filtered: [Agency] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
        if q.isEmpty { return vm.agencies }
        return vm.agencies.filter {
            $0.name.localizedCaseInsensitiveContains(q) ||
            $0.agencyId.localizedCaseInsensitiveContains(q)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()

                if vm.isLoading && vm.agencies.isEmpty {
                    ProgressView().tint(RCTheme.accentLight)
                } else {
                    List {
                        if let error = vm.error {
                            Section {
                                Text(error)
                                    .font(.system(size: 13))
                                    .foregroundColor(RCTheme.danger)
                            }
                            .listRowBackground(Color(hex: "#2A0808"))
                        }

                        ForEach(filtered) { agency in
                            AgencySelectRow(agency: agency) {
                                auth.setActiveAgency(agency)
                            }
                            .listRowBackground(RCTheme.surface1)
                            .listRowSeparatorTint(RCTheme.border)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .searchable(text: $search, prompt: "Search agencies")
                }
            }
            .navigationTitle("Select agency")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Sign out") { auth.signOut() }
                        .foregroundColor(RCTheme.danger)
                        .font(.system(size: 13))
                }
            }
            .task { await vm.load() }
        }
    }
}

struct AgencySelectRow: View {
    let agency: Agency
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(RCTheme.surface2)
                        .frame(width: 38, height: 38)
                    Text(initials(agency.name))
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(RCTheme.textSecondary)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(agency.name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(RCTheme.textPrimary)
                    HStack(spacing: 6) {
                        Text(agency.agencyId)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(RCTheme.textMuted)
                        if let tier = agency.planTier, !tier.isEmpty {
                            Text("·")
                                .foregroundColor(RCTheme.textMuted)
                                .font(.system(size: 11))
                            Text(tier.capitalized)
                                .font(.system(size: 11))
                                .foregroundColor(RCTheme.textMuted)
                        }
                    }
                }

                Spacer()

                if let count = agency.codeCount {
                    Text("\(count) codes")
                        .font(.system(size: 11))
                        .foregroundColor(RCTheme.textMuted)
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundColor(RCTheme.textMuted)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(agency.name)
    }

    private func initials(_ name: String) -> String {
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return String(words[0].prefix(1) + words[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}
