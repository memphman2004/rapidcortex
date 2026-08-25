import SwiftUI

enum MainTab: String, CaseIterable, Identifiable {
    case dashboard
    case incidents
    case commandMap
    case maps

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard: "Dashboard"
        case .incidents: "Incidents"
        case .commandMap: "Command Map"
        case .maps: "Hospital routing"
        }
    }

    var systemImage: String {
        switch self {
        case .dashboard: "gauge.with.dots.needle.67percent"
        case .incidents: "list.bullet.clipboard"
        case .commandMap: "map"
        case .maps: "cross.case"
        }
    }
}

struct MainShellView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var cognito: CognitoWebAuthCoordinator
    @State private var tab: MainTab = .dashboard
    @State private var webReloadNonce = 0
    @State private var webNavigationPath: String?
    @State private var webNavigationNonce = 0
    @State private var showNativeHospitalMap = false
    @State private var showCommandMap = false

    private var nativeToolbarAccess: DesktopRoleRouting.NativeToolbarAccess {
        guard let idToken = KeychainTokenStore.idToken() else {
            return DesktopRoleRouting.NativeToolbarAccess(showCommandMap: false, showHospitalRouting: false)
        }
        return DesktopRoleRouting.nativeToolbarAccess(fromIdToken: idToken)
    }

    private var sessionRole: String {
        guard let idToken = KeychainTokenStore.idToken() else { return "dispatcher" }
        return DesktopRoleRouting.sessionRole(fromIdToken: idToken)
    }

    private var jurisdictionSlug: String {
        DesktopWorkspaceNav.resolveJurisdictionSlug(
            configured: session.configuration.defaultJurisdictionSlug,
            idToken: KeychainTokenStore.idToken()
        )
    }

    private var visibleLegacyTabs: [MainTab] {
        let access = nativeToolbarAccess
        return MainTab.allCases.filter { item in
            switch item {
            case .commandMap:
                return access.showCommandMap
            case .maps:
                return access.showHospitalRouting && session.configuration.enableNativeMapKit
            default:
                return true
            }
        }
    }

    var body: some View {
        Group {
            if let webBase = session.configuration.webAppBaseURL {
                webWorkspaceChrome(webBase: webBase)
            } else {
                webWorkspaceRequiredView
            }
        }
        .onAppear {
            ensureLegacyTabSelectionValid()
        }
        .onChange(of: session.isSignedIn) { _, _ in
            ensureLegacyTabSelectionValid()
        }
    }

    private func navigateWeb(to path: String) {
        webNavigationPath = path
        webNavigationNonce += 1
    }

    private func ensureLegacyTabSelectionValid() {
        let visible = visibleLegacyTabs
        guard !visible.isEmpty else { return }
        if !visible.contains(tab) {
            tab = visible[0]
        }
    }

    @ViewBuilder
    private func webWorkspaceChrome(webBase: URL) -> some View {
        let access = nativeToolbarAccess
        let role = sessionRole
        let quickLinks = DesktopWorkspaceNav.quickLinks(role: role, jurisdictionSlug: jurisdictionSlug)
        let agencyId = agencyLabelFromToken()

        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("Rapid Cortex")
                    .font(.headline)
                if let agencyId {
                    Text(agencyId)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Text(DesktopWorkspaceNav.roleBadgeLabel(forRole: role))
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.accentColor.opacity(0.15))
                    .clipShape(Capsule())

                Divider()
                    .frame(height: 18)

                ForEach(quickLinks) { link in
                    Button(link.label) {
                        navigateWeb(to: link.path)
                    }
                    .buttonStyle(.borderless)
                    .font(.caption.weight(.medium))
                }

                Spacer()

                if access.showCommandMap {
                    Button {
                        showCommandMap = true
                    } label: {
                        Label("Command Map", systemImage: "map")
                    }
                    .help("Native command map (incident, caller, hospital, responder)")
                }

                if access.showHospitalRouting && session.configuration.enableNativeMapKit {
                    Button {
                        showNativeHospitalMap = true
                    } label: {
                        Label("Hospital routing", systemImage: "cross.case")
                    }
                    .help("Native Apple Maps hospital routing")
                }

                if DesktopWorkspaceNav.showsOperationsManual(forRole: role) {
                    Menu {
                        Button("Complete Operations Manual") {
                            navigateWeb(to: DesktopWorkspaceNav.operationsManualHref())
                        }
                        Button("Ring Connect (Chapter 10B)") {
                            navigateWeb(to: DesktopWorkspaceNav.operationsManualHref(includeRingChapter: true))
                        }
                    } label: {
                        Text("Manual")
                    }
                    .help("Agency operations manual (same as web app)")
                }

                Button("Reload") { webReloadNonce += 1 }
                Button("Sign out") {
                    session.signOutWithHostedUI(cognito: cognito)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.bar)

            WorkspaceWebShellView(
                webAppBaseURL: webBase,
                jurisdictionSlug: jurisdictionSlug,
                reloadNonce: webReloadNonce,
                navigationPath: webNavigationPath,
                navigationNonce: webNavigationNonce,
                onNeedsReauth: {
                    session.signOut()
                    session.lastError = "Session expired or was rejected by the web app. Please sign in again."
                }
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .sheet(isPresented: $showNativeHospitalMap) {
            NativeHospitalMapView(viewModel: makeHospitalRoutingViewModel())
                .frame(minWidth: 900, minHeight: 560)
        }
        .sheet(isPresented: $showCommandMap) {
            NavigationStack {
                RapidCortexMapView(viewModel: CommandMapViewModel())
                    .navigationTitle("Command Map")
            }
            .frame(minWidth: 900, minHeight: 560)
        }
    }

    private var webWorkspaceRequiredView: some View {
        Group {
            #if DEBUG
            legacyNativeChrome
            #else
            VStack(spacing: 16) {
                Image(systemName: "globe")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text("Web workspace required")
                    .font(.title2.weight(.semibold))
                Text("Set **WEB_APP_BASE_URL** in Secrets.plist (e.g. `https://app.rapidcortex.us`) so this desktop app loads the same Rapid Cortex web workspace as the browser.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 420)
                Text("After updating Secrets.plist, use **Reload configuration** on the sign-in screen or restart the app.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            #endif
        }
    }

    private func agencyLabelFromToken() -> String? {
        guard let idToken = KeychainTokenStore.idToken(),
              let payload = DesktopRoleRouting.jwtPayloadDictionary(idToken),
              let agency = payload["custom:agencyId"] as? String else { return nil }
        let trimmed = agency.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func makeHospitalRoutingViewModel() -> HospitalRoutingViewModel {
        let client = ApiClient(configuration: session.configuration) { [session] in
            session.idTokenForApi()
        }
        return HospitalRoutingViewModel(api: client)
    }

    @ViewBuilder
    private var legacyNativeChrome: some View {
        NavigationSplitView {
            List(visibleLegacyTabs, selection: $tab) { t in
                Label(t.title, systemImage: t.systemImage).tag(t)
            }
            .navigationTitle("Rapid Cortex (dev)")
        } detail: {
            NavigationStack {
                Group {
                    switch tab {
                    case .dashboard:
                        DashboardView()
                    case .incidents:
                        IncidentsPlaceholderView()
                    case .commandMap:
                        RapidCortexMapView(viewModel: CommandMapViewModel())
                    case .maps:
                        if session.configuration.enableNativeMapKit {
                            NativeHospitalMapView(
                                viewModel: makeHospitalRoutingViewModel(),
                                showsCloseButton: false
                            )
                        } else {
                            Text("Native MapKit is disabled. Set ENABLE_NATIVE_MAPKIT=1 in Secrets.plist.")
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                }
                .navigationTitle(tab.title)
            }
        }
    }
}
