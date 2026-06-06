import SwiftUI

@main
struct RapidCortexDesktopApp: App {
    @StateObject private var session = SessionStore()
    @StateObject private var network = NetworkPathMonitor()
    @StateObject private var cognito = CognitoWebAuthCoordinator()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(network)
                .environmentObject(cognito)
                .onOpenURL { url in
                    cognito.handleOAuthCallbackURL(url)
                    Task { @MainActor in
                        session.syncSessionFromKeychain()
                    }
                }
                .onAppear {
                    network.start()
                    Task { await session.restoreSessionIfNeeded(cognito: cognito) }
                }
        }
        .commands {
            CommandMenu("Session") {
                Button("Sign Out") { session.signOutWithHostedUI(cognito: cognito) }
            }
        }
    }
}
