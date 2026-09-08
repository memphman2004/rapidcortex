import SwiftUI
import UIKit

@main
struct RapidCortexFieldApp: App {
    @StateObject private var auth = CognitoAuthManager.shared
    @StateObject private var api = RCAPIClient.shared
    @State private var showSplash = !SplashGate.hasEnteredRecently()

    init() { configureGlobalAppearance() }

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isAuthenticated {
                    routedView
                        .environmentObject(auth)
                        .environmentObject(api)
                } else if showSplash {
                    EnterTheCortexView {
                        SplashGate.markEntered()
                        withAnimation(.easeInOut(duration: 0.35)) {
                            showSplash = false
                        }
                    }
                } else {
                    LoginView()
                        .environmentObject(auth)
                }
            }
            .preferredColorScheme(.dark)
            .tint(RCTheme.amber)
        }
    }

    @ViewBuilder
    private var routedView: some View {
        if auth.claims == nil {
            ProgressView().tint(RCTheme.accentLight)
        } else {
            switch RCRouter.destination(
                for: auth.claims,
                selectedAgencyVertical: platformSelectedVertical
            ) {
            case .qrNFC:
                QRNFCRootView()
            case .dispatch:
                Dispatch911RootView()
            case .agencySelect:
                AgencySelectView()
            case .noAccess:
                NoAccessView()
            }
        }
    }

    /// Platform admins only: vertical of the agency they picked (never shown).
    private var platformSelectedVertical: String? {
        guard auth.claims?.isPlatformAdmin == true else { return nil }
        guard !auth.selectedAgencyId.isEmpty else { return nil }
        return auth.activeAgencyVertical
    }

    private func configureGlobalAppearance() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = UIColor(RCTheme.bg)
        nav.titleTextAttributes = [.foregroundColor: UIColor(RCTheme.textPrimary)]
        nav.largeTitleTextAttributes = [.foregroundColor: UIColor(RCTheme.textPrimary)]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav

        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(red: 10 / 255, green: 15 / 255, blue: 30 / 255, alpha: 1)
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
        UITabBar.appearance().unselectedItemTintColor = UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
    }
}

struct QRNFCRootView: View {
    @EnvironmentObject var auth: CognitoAuthManager

    private var defaultVertical: String {
        auth.qrCodeVertical
    }

    var body: some View {
        TabView {
            CodesListView()
                .tabItem { Label("Codes", systemImage: "qrcode") }
            if auth.claims?.canManageCodes == true {
                NewCodeView(agencyId: auth.selectedAgencyId, defaultVertical: defaultVertical)
                    .tabItem { Label("Create", systemImage: "plus") }
            }
            if auth.claims?.isPlatformAdmin == true {
                AgenciesView()
                    .tabItem { Label("Agencies", systemImage: "building.2") }
            }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .tint(RCTheme.amber)
        .onAppear {
            Task { await auth.refreshIfNeeded() }
        }
    }
}

struct Dispatch911RootView: View {
    @EnvironmentObject var auth: CognitoAuthManager

    var body: some View {
        TabView {
            CommandHomeView()
                .tabItem { Label("Home", systemImage: "house") }
            DispatcherStatusView()
                .tabItem { Label("Staff", systemImage: "person.2") }
            ContinuityLogView()
                .tabItem { Label("Log", systemImage: "note.text") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
        .tint(RCTheme.danger)
        .onAppear {
            Task { await auth.refreshIfNeeded() }
        }
    }
}

struct NoAccessView: View {
    @EnvironmentObject var auth: CognitoAuthManager

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 44))
                    .foregroundColor(RCTheme.textMuted)
                Text("Access not configured")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)
                Text("Your account (\(auth.claims?.email ?? "")) isn't set up for this application. Contact your administrator or Rapid Cortex support.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                Link("support@rapidcortex.us", destination: URL(string: "mailto:support@rapidcortex.us")!)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(RCTheme.accentLight)
                Button("Sign out") { auth.signOut() }
                    .font(.system(size: 14))
                    .foregroundColor(RCTheme.danger)
                    .padding(.top, 8)
            }
            .padding(24)
        }
    }
}
