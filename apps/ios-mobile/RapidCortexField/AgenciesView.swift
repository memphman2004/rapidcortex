import SwiftUI

@MainActor
final class AgenciesViewModel: ObservableObject {
    @Published private(set) var agencies: [Agency] = []
    @Published private(set) var isLoading = false
    @Published var error: String?
    @Published var search = ""

    var filtered: [Agency] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return agencies }
        return agencies.filter {
            $0.name.lowercased().contains(q) || $0.agencyId.lowercased().contains(q)
        }
    }

    func load(claims: RCUserClaims?) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        guard let claims else {
            agencies = []
            return
        }

        if claims.isPlatformAdmin {
            do {
                agencies = try await RCAPIClient.shared.listAgencies()
            } catch {
                self.error = error.localizedDescription
                agencies = Self.fallbackAgencies(claims: claims)
            }
        } else {
            agencies = Self.fallbackAgencies(claims: claims)
            let agencyId = claims.agencyId.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !agencyId.isEmpty else { return }
            do {
                agencies = [try await RCAPIClient.shared.getAgency(agencyId: agencyId)]
            } catch {
                // Keep the JWT fallback. Native tokens currently 401 on GET /api/agencies/{id}.
            }
        }
    }

    private static func fallbackAgencies(claims: RCUserClaims) -> [Agency] {
        let agencyId = claims.agencyId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !agencyId.isEmpty else { return [] }
        return [Agency(from: claims)]
    }
}

struct AgenciesView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @StateObject private var vm = AgenciesViewModel()

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            if vm.isLoading && vm.agencies.isEmpty {
                ProgressView().tint(RCTheme.amber)
            } else {
                List {
                    if auth.claims?.isPlatformAdmin == true {
                        Section {
                            TextField("Search agencies", text: $vm.search)
                                .foregroundColor(RCTheme.textPrimary)
                        }
                        .listRowBackground(RCTheme.surface1)
                    }

                    Section {
                        ForEach(vm.filtered) { agency in
                            Button {
                                auth.selectAgency(agency.agencyId)
                            } label: {
                                AgencyRow(
                                    agency: agency,
                                    isSelected: agency.agencyId == auth.selectedAgencyId
                                )
                            }
                            .listRowBackground(RCTheme.surface1)
                            .listRowSeparatorTint(RCTheme.border)
                        }
                    } header: {
                        Text(auth.claims?.isPlatformAdmin == true
                             ? "Tap an agency to load its codes"
                             : "Your agency")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(RCTheme.textMuted)
                            .textCase(.uppercase)
                    }

                    if let error = vm.error {
                        Section {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundColor(RCTheme.danger)
                        }
                        .listRowBackground(Color(hex: "#2A0808"))
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Agencies")
        .task { await vm.load(claims: auth.claims) }
        .refreshable { await vm.load(claims: auth.claims) }
    }
}

struct VerticalBadge: View {
    let vertical: String

    var body: some View {
        RCBadge(label: vertical.uppercased(), tone: .accent, small: true)
    }
}

struct AgencyRow: View {
    let agency: Agency
    let isSelected: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(agency.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)
                HStack(spacing: 8) {
                    if !agency.vertical.isEmpty {
                        VerticalBadge(vertical: agency.vertical)
                    }
                    if let tier = agency.planTier {
                        Text(tier.uppercased())
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(RCTheme.textMuted)
                    }
                    if let count = agency.codeCount {
                        Text("\(count) codes")
                            .font(.system(size: 11))
                            .foregroundColor(RCTheme.textMuted)
                    }
                }
                Text(agency.agencyId)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(RCTheme.textMuted)
            }
            Spacer()
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(RCTheme.amber)
            }
        }
        .padding(.vertical, 4)
    }
}
