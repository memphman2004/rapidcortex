import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isSignedIn {
                MainShellView()
            } else {
                LoginView()
            }
        }
        .frame(minWidth: 720, minHeight: 480)
    }
}
