import SwiftUI

struct DispatcherStatusView: View {
    @State private var items: [FieldStaffMember] = []
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                if isLoading && items.isEmpty {
                    ProgressView().tint(RCTheme.danger)
                } else {
                    List {
                        if let error {
                            Text(error)
                                .foregroundColor(RCTheme.danger)
                                .listRowBackground(RCTheme.surface1)
                        }
                        if items.isEmpty {
                            Text("No dispatchers currently online.")
                                .foregroundColor(RCTheme.textMuted)
                                .listRowBackground(RCTheme.surface1)
                        }
                        ForEach(items) { person in
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(statusColor(person.status))
                                    .frame(width: 10, height: 10)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(person.displayName)
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundColor(RCTheme.textPrimary)
                                    Text(person.position ?? person.role)
                                        .font(.system(size: 12))
                                        .foregroundColor(RCTheme.textMuted)
                                }
                                Spacer()
                                Text(statusLabel(person.status))
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(statusColor(person.status))
                            }
                            .listRowBackground(RCTheme.surface1)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Staff")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        if items.isEmpty { isLoading = true }
        defer { isLoading = false }
        do {
            items = try await RCAPIClient.shared.fieldCommandStaff()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "on_call": return RCTheme.danger
        case "online": return RCTheme.success
        default: return RCTheme.textMuted
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status.lowercased() {
        case "on_call": return "On call"
        case "online": return "Online"
        default: return status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}
