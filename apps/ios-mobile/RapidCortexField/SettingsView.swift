import SwiftUI
import UIKit

struct SettingsView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @State private var confirmSignOut = false
    @State private var showingRequestAccess = false

    private var claims: RCUserClaims? { auth.claims }

    private var requestableTools: [AccessTool] {
        AccessTool.requestable(for: claims)
    }

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
                        settingsRow(label: "Email", value: claims?.email ?? "—")
                        HStack {
                            Text("Role")
                                .foregroundColor(RCTheme.textMuted)
                            Spacer()
                            Text(claims?.roleLabel ?? "—")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(RCTheme.accentLight)
                        }
                        settingsRow(
                            label: "Agency",
                            value: auth.operationalAgencyId
                        )
                    } header: {
                        sectionHeader("Account")
                    }
                    .listRowBackground(RCTheme.surface1)
                    .listRowSeparatorTint(RCTheme.border)

                    if !requestableTools.isEmpty {
                        Section {
                            Button {
                                showingRequestAccess = true
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "plus.circle")
                                        .font(.system(size: 16))
                                        .foregroundColor(RCTheme.accentLight)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Request additional access")
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundColor(RCTheme.textPrimary)
                                        Text("Add more tools to your account")
                                            .font(.system(size: 11))
                                            .foregroundColor(RCTheme.textMuted)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 12))
                                        .foregroundColor(RCTheme.textMuted)
                                }
                            }
                        } header: {
                            sectionHeader("Access")
                        }
                        .listRowBackground(RCTheme.surface1)
                        .listRowSeparatorTint(RCTheme.border)
                    }

                    if claims?.isPlatformAdmin == true {
                        Section {
                            Button {
                                auth.clearActiveAgencySelection()
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Change agency")
                                        .foregroundColor(RCTheme.textPrimary)
                                    Text(auth.selectedAgencyId.isEmpty ? "Select an agency" : auth.selectedAgencyId)
                                        .font(.system(size: 12))
                                        .foregroundColor(RCTheme.textSecondary)
                                }
                            }
                        } header: {
                            sectionHeader("Details")
                        }
                        .listRowBackground(RCTheme.surface1)
                        .listRowSeparatorTint(RCTheme.border)

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
            .navigationTitle("Settings")
            .confirmationDialog("Sign out of Rapid Cortex Mobile?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { auth.signOut() }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showingRequestAccess) {
                RequestAccessView(
                    requestableTools: requestableTools,
                    agencyId: auth.operationalAgencyId,
                    userEmail: claims?.email ?? ""
                )
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

struct AccessTool: Identifiable, Equatable {
    let id: String
    let name: String
    let description: String
    let icon: String

    static let qrNfc = AccessTool(
        id: "qr_nfc",
        name: "QR & NFC code management",
        description: "Create and program reporting codes for your locations",
        icon: "qrcode"
    )

    static let dispatchOps = AccessTool(
        id: "dispatch_ops",
        name: "Operational dashboard",
        description: "Supervisor and incident awareness tools",
        icon: "house"
    )

    static func requestable(for claims: RCUserClaims?) -> [AccessTool] {
        guard let claims, !claims.isPlatformAdmin else { return [] }
        switch RCRouter.destination(for: claims) {
        case .qrNFC:
            return [.dispatchOps]
        case .dispatch:
            return [.qrNfc]
        case .agencySelect, .noAccess:
            return []
        }
    }
}

struct RequestAccessView: View {
    let requestableTools: [AccessTool]
    let agencyId: String
    let userEmail: String

    @Environment(\.dismiss) private var dismiss
    @State private var selectedTool: AccessTool?
    @State private var reason = ""
    @State private var isSubmitting = false
    @State private var submitted = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                RCTheme.bg.ignoresSafeArea()
                if submitted {
                    submittedView
                } else {
                    requestForm
                }
            }
            .navigationTitle("Request access")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(RCTheme.textMuted)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private var requestForm: some View {
        List {
            Section {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "building.2")
                        .font(.system(size: 14))
                        .foregroundColor(RCTheme.accentLight)
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Scoped to your agency")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(RCTheme.textPrimary)
                        Text("Any access added applies to your agency only. Rapid Cortex will verify and activate it.")
                            .font(.system(size: 11))
                            .foregroundColor(RCTheme.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.vertical, 2)
            }
            .listRowBackground(Color(hex: "#0A1A3A"))
            .listRowSeparatorTint(RCTheme.border)

            Section {
                ForEach(requestableTools) { tool in
                    Button {
                        withAnimation { selectedTool = tool }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: tool.icon)
                                .font(.system(size: 16))
                                .foregroundColor(RCTheme.accentLight)
                                .frame(width: 32)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tool.name)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(RCTheme.textPrimary)
                                Text(tool.description)
                                    .font(.system(size: 11))
                                    .foregroundColor(RCTheme.textMuted)
                            }
                            Spacer()
                            Image(systemName: selectedTool?.id == tool.id ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(selectedTool?.id == tool.id ? RCTheme.accentLight : RCTheme.border)
                        }
                    }
                    .listRowBackground(
                        selectedTool?.id == tool.id
                            ? RCTheme.accentLight.opacity(0.08)
                            : RCTheme.surface1
                    )
                }
            } header: {
                Text("What do you need access to?")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(RCTheme.textMuted)
                    .textCase(.uppercase)
            }
            .listRowSeparatorTint(RCTheme.border)

            Section {
                TextEditor(text: $reason)
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textPrimary)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 70)
            } header: {
                Text("Reason (optional)")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(RCTheme.textMuted)
                    .textCase(.uppercase)
            }
            .listRowBackground(RCTheme.surface1)

            if let error {
                Section {
                    Text(error).font(.system(size: 13)).foregroundColor(RCTheme.danger)
                }
                .listRowBackground(RCTheme.surface1)
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if isSubmitting { ProgressView().tint(.white).scaleEffect(0.8) }
                        Text(isSubmitting ? "Sending request…" : "Send request")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(selectedTool != nil ? RCTheme.accent : RCTheme.surface2)
                    .foregroundColor(selectedTool != nil ? .white : RCTheme.textMuted)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(selectedTool == nil || isSubmitting)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 16, trailing: 16))
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private var submittedView: some View {
        VStack(spacing: 20) {
            Spacer()
            ZStack {
                Circle().fill(Color(hex: "#0A2A1A")).frame(width: 72, height: 72)
                Image(systemName: "checkmark")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundColor(RCTheme.success)
            }
            Text("Request sent")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(RCTheme.textPrimary)
            if let tool = selectedTool {
                Text("Your request for \(tool.name) has been sent to Rapid Cortex. They’ll verify with your agency and activate access after review.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Text("All access is scoped to \(agencyId).")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(RCTheme.textMuted)
            }
            Spacer()
            Button("Done") { dismiss() }
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(RCTheme.accent)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
        }
    }

    private func submit() async {
        guard let tool = selectedTool else { return }
        isSubmitting = true
        error = nil
        defer { isSubmitting = false }
        let request = AccessRequest(
            requestedWorkspace: tool.id,
            requestedWorkspaceTitle: tool.name,
            agencyId: agencyId,
            userEmail: userEmail,
            reason: reason.trimmingCharacters(in: .whitespaces)
        )
        do {
            try await RCAPIClient.shared.submitAccessRequest(request: request)
            submitted = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}
