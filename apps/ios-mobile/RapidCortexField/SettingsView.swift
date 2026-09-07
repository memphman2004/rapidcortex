import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @State private var confirmSignOut = false

    private var version: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                List {
                    Section {
                        settingsRow(label: "Email", value: auth.claims?.email ?? "—")
                        HStack {
                            Text("Role")
                                .foregroundColor(RCTheme.textMuted)
                            Spacer()
                            Text(auth.claims?.roleLabel ?? "—")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(RCTheme.accentLight)
                        }
                        settingsRow(label: "Agency ID", value: auth.selectedAgencyId.isEmpty ? (auth.claims?.agencyId ?? "—") : auth.selectedAgencyId)
                    } header: {
                        sectionHeader("Account")
                    }
                    .listRowBackground(RCTheme.surface1)
                    .listRowSeparatorTint(RCTheme.border)

                    Section {
                        NavigationLink {
                            AgenciesView()
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Agency")
                                    .foregroundColor(RCTheme.textPrimary)
                                Text(auth.selectedAgencyId.isEmpty ? "Select agency" : auth.selectedAgencyId)
                                    .font(.system(size: 12))
                                    .foregroundColor(RCTheme.textSecondary)
                            }
                        }
                    } header: {
                        sectionHeader("Details")
                    }
                    .listRowBackground(RCTheme.surface1)
                    .listRowSeparatorTint(RCTheme.border)

                    if auth.claims?.isPlatformAdmin == true {
                        Section {
                            NavigationLink {
                                SiteQrNfcView()
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Label("Rapid Cortex site QR & NFC", systemImage: "globe")
                                        .foregroundColor(RCTheme.textPrimary)
                                    Text("www.rapidcortex.us — booth and marketing signs")
                                        .font(.system(size: 11))
                                        .foregroundColor(RCTheme.textMuted)
                                }
                            }
                        } header: {
                            sectionHeader("Marketing")
                        }
                        .listRowBackground(RCTheme.surface1)
                        .listRowSeparatorTint(RCTheme.border)
                    }

                    Section {
                        settingsRow(label: "Version", value: version)
                        settingsRow(label: "Environment", value: "Production")
                        settingsRow(label: "Bundle", value: "us.rapidcortex.field")
                    } header: {
                        sectionHeader("App")
                    }
                    .listRowBackground(RCTheme.surface1)
                    .listRowSeparatorTint(RCTheme.border)

                    Section {
                        Button {
                            if let url = URL(string: "mailto:support@rapidcortex.us") {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            Label("Contact Support", systemImage: "envelope")
                                .foregroundColor(RCTheme.textPrimary)
                        }
                        Button {
                            if let url = URL(string: "https://rapidcortex.us") {
                                UIApplication.shared.open(url)
                            }
                        } label: {
                            Label("Visit rapidcortex.us", systemImage: "safari")
                                .foregroundColor(RCTheme.textPrimary)
                        }
                    } header: {
                        sectionHeader("Support")
                    }
                    .listRowBackground(RCTheme.surface1)
                    .listRowSeparatorTint(RCTheme.border)

                    Section {
                        Button(role: .destructive) {
                            confirmSignOut = true
                        } label: {
                            Text("Sign Out")
                                .frame(maxWidth: .infinity, alignment: .center)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(RCTheme.danger)
                        }
                    }
                    .listRowBackground(RCTheme.surface1)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Account")
            .confirmationDialog("Sign out of Rapid Cortex Mobile?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { auth.signOut() }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private func settingsRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundColor(RCTheme.textMuted)
            Spacer()
            Text(value)
                .foregroundColor(RCTheme.textPrimary)
                .multilineTextAlignment(.trailing)
        }
        .font(.system(size: 14))
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(RCTheme.textMuted)
            .textCase(.uppercase)
            .tracking(0.5)
    }
}
