import SwiftUI
import UIKit

@main
struct RapidCortexFieldApp: App {
    @StateObject private var auth = CognitoAuthManager.shared
    @StateObject private var api = RCAPIClient.shared
    @State private var showSplash = !SplashGate.hasEnteredRecently()

    var body: some Scene {
        WindowGroup {
            Group {
                if auth.isAuthenticated {
                    ContentRootView()
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
}

struct ContentRootView: View {
    @EnvironmentObject var auth: CognitoAuthManager

    var body: some View {
        TabView {
            CodesListView()
                .tabItem {
                    Label("QR & NFC Codes", systemImage: "tag.fill")
                }

            NewCodeView(
                agencyId: auth.selectedAgencyId,
                defaultVertical: defaultVertical
            )
            .tabItem {
                Label("Create", systemImage: "plus")
            }

            SettingsView()
                .tabItem {
                    Label("Account", systemImage: "person.fill")
                }
        }
        .tint(RCTheme.amber)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(red: 10 / 255, green: 15 / 255, blue: 30 / 255, alpha: 1)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
            UITabBar.appearance().unselectedItemTintColor = UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
            Task { await auth.refreshIfNeeded() }
        }
    }

    private var defaultVertical: String {
        let role = auth.claims?.canonicalRole ?? ""
        if role.contains("campus") { return "campus" }
        if role.contains("transit") { return "transit" }
        return "venue"
    }
}
