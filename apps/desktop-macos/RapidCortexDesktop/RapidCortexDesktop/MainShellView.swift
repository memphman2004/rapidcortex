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
    @State private var showNativeHospitalMap = false
    @State private var showCommandMap = false

    private var nativeToolbarAccess: DesktopRoleRouting.NativeToolbarAccess {
        guard let idToken = KeychainTokenStore.idToken() else {
            return DesktopRoleRouting.NativeToolbarAccess(showCommandMap: false, showHospitalRouting: false)
        }
        return DesktopRoleRouting.nativeToolbarAccess(fromIdToken: idToken)
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
                legacyNativeChrome
            }
        }
        .onAppear {
            ensureLegacyTabSelectionValid()
        }
        .onChange(of: session.isSignedIn) { _, _ in
            ensureLegacyTabSelectionValid()
        }
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
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("Rapid Cortex")
                    .font(.headline)
                Spacer()
                if access.showCommandMap {
                    Button {
                        showCommandMap = true
                    } label: {
                        Label("Command Map", systemImage: "map")
                    }
                    .help("Open native command map (incident, caller, hospital, responder)")
                }

                if access.showHospitalRouting && session.configuration.enableNativeMapKit {
                    Button {
                        showNativeHospitalMap = true
                    } label: {
                        Label("Hospital routing", systemImage: "cross.case")
                    }
                    .help("Open native Apple Maps hospital routing")
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
                jurisdictionSlug: session.configuration.defaultJurisdictionSlug,
                reloadNonce: webReloadNonce,
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
            .navigationTitle("Rapid Cortex")
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
