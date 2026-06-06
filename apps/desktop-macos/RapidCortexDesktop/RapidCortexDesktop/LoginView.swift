import AppKit
import SwiftUI

// MARK: - Chrome (Cursor-like dark enterprise)

private enum LoginChrome {
    static let background = Color(red: 13 / 255, green: 17 / 255, blue: 23 / 255)
    static let card = Color(red: 22 / 255, green: 27 / 255, blue: 34 / 255)
    static let border = Color(red: 48 / 255, green: 54 / 255, blue: 61 / 255)
    static let muted = Color(red: 139 / 255, green: 148 / 255, blue: 158 / 255)
    static let primaryBlue = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
    static let primaryBlueHover = Color(red: 29 / 255, green: 78 / 255, blue: 216 / 255)
    static let primaryBlueBright = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255)
    static let linkBlue = Color(red: 88 / 255, green: 166 / 255, blue: 255 / 255)
}

private struct ToastModel: Equatable, Identifiable {
    let id = UUID()
    let message: String
    let isError: Bool
}

// MARK: - Background

private struct LoginBackgroundView: View {
    var body: some View {
        ZStack {
            LoginChrome.background
            RadialGradient(
                colors: [
                    Color(red: 30 / 255, green: 58 / 255, blue: 95 / 255).opacity(0.35),
                    Color.clear,
                ],
                center: UnitPoint(x: 0.5, y: 0.15),
                startRadius: 40,
                endRadius: 520
            )
            GridLinesView()
                .opacity(0.45)
        }
        .ignoresSafeArea()
    }
}

private struct GridLinesView: View {
    private let step: CGFloat = 28
    private let lineColor = Color.white.opacity(0.035)

    var body: some View {
        Canvas { context, size in
            var x: CGFloat = 0
            while x <= size.width {
                var p = Path()
                p.move(to: CGPoint(x: x, y: 0))
                p.addLine(to: CGPoint(x: x, y: size.height))
                context.stroke(p, with: .color(lineColor), lineWidth: 1)
                x += step
            }
            var y: CGFloat = 0
            while y <= size.height {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: y))
                p.addLine(to: CGPoint(x: size.width, y: y))
                context.stroke(p, with: .color(lineColor), lineWidth: 1)
                y += step
            }
        }
        .allowsHitTesting(false)
    }
}

private struct AgencySSOButtonStyle: ButtonStyle {
    var isHovering: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(fillColor(isPressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
    }

    private func fillColor(isPressed: Bool) -> Color {
        if isPressed { return LoginChrome.primaryBlueHover }
        if isHovering { return LoginChrome.primaryBlueBright }
        return LoginChrome.primaryBlue
    }
}

// MARK: - Toast

private struct LoginToastView: View {
    let model: ToastModel
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: model.isError ? "exclamationmark.circle.fill" : "info.circle.fill")
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(model.isError ? Color.orange : Color.cyan)
            Text(model.message)
                .font(.callout)
                .foregroundStyle(Color.white.opacity(0.92))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.cancelAction)
        }
        .padding(14)
        .frame(maxWidth: 420)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(LoginChrome.card)
                .shadow(color: .black.opacity(0.45), radius: 28, y: 12)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(LoginChrome.border.opacity(0.6), lineWidth: 1)
        )
    }
}

// MARK: - Login

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var cognito: CognitoWebAuthCoordinator

    @State private var isBusy = false
    @State private var contentOpacity: Double = 0
    @State private var toast: ToastModel?
    @State private var toastDismissTask: Task<Void, Never>?
    @State private var ssoHover = false
    @State private var showDebugSmokeSheet = false

    private var appVersion: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    private var appIcon: NSImage {
        NSApp.applicationIconImage
            ?? NSWorkspace.shared.icon(forFile: Bundle.main.bundlePath)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            LoginBackgroundView()

            VStack(spacing: 0) {
                Spacer(minLength: 0)

                VStack(spacing: 28) {
                    VStack(spacing: 14) {
                        Image(nsImage: appIcon)
                            .resizable()
                            .interpolation(.high)
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: .black.opacity(0.45), radius: 16, y: 8)

                        Text("Rapid Cortex")
                            .font(.system(size: 28, weight: .bold, design: .default))
                            .foregroundStyle(.white)

                        Text("Intelligence at the speed of response")
                            .font(.system(size: 15, weight: .regular, design: .default))
                            .foregroundStyle(LoginChrome.muted)
                            .multilineTextAlignment(.center)

                        Text("Sign in opens the Rapid Cortex site in your browser; when you finish, you return here automatically.")
                            .font(.system(size: 13, weight: .regular, design: .default))
                            .foregroundStyle(LoginChrome.muted.opacity(0.95))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 12)
                    }

                    VStack(alignment: .leading, spacing: 20) {
                        VStack(spacing: 14) {
                            Button {
                                Task { await signIn() }
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: "lock.shield.fill")
                                        .font(.system(size: 18, weight: .semibold))
                                    Text("Sign in with Agency SSO")
                                        .font(.system(size: 16, weight: .semibold, design: .default))
                                }
                            }
                            .buttonStyle(AgencySSOButtonStyle(isHovering: ssoHover))
                            .disabled(!session.configuration.canSignInWithWeb || isBusy)
                            .onHover { ssoHover = $0 }
                            .opacity(session.configuration.canSignInWithWeb ? 1 : 0.45)

                            if isBusy {
                                HStack(spacing: 10) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Waiting for secure browser…")
                                        .font(.callout)
                                        .foregroundStyle(LoginChrome.muted)
                                }
                                .frame(maxWidth: .infinity)
                            }

                            if !session.configuration.isConfigured {
                                Text("This build is not configured for sign-in. Ask your administrator for a configured app package, or use the footer menu to reload after installing Secrets.plist.")
                                    .font(.caption)
                                    .foregroundStyle(Color.orange.opacity(0.95))
                                    .fixedSize(horizontal: false, vertical: true)
                            } else if !session.configuration.canSignInWithWeb {
                                Text("Add WEB_APP_BASE_URL or NEXT_PUBLIC_SITE_URL to Secrets.plist (your Rapid Cortex website URL, e.g. https://www.rapidcortex.us) so the app can open web sign-in.")
                                    .font(.caption)
                                    .foregroundStyle(Color.orange.opacity(0.95))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }

                        Rectangle()
                            .fill(LoginChrome.border.opacity(0.85))
                            .frame(height: 1)

                        VStack(alignment: .leading, spacing: 10) {
                            Text("Access is provisioned by your agency administrator.")
                                .font(.system(size: 12, weight: .regular, design: .default))
                                .foregroundStyle(LoginChrome.muted)
                                .fixedSize(horizontal: false, vertical: true)

                            Button {
                                openSupportContact()
                            } label: {
                                HStack(spacing: 4) {
                                    Text("Contact support")
                                        .font(.system(size: 12, weight: .medium, design: .default))
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 11, weight: .semibold))
                                }
                                .foregroundStyle(LoginChrome.linkBlue)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(28)
                    .frame(maxWidth: 400)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(LoginChrome.card)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(LoginChrome.border, lineWidth: 1)
                    )
                }
                .padding(.horizontal, 40)
                .opacity(contentOpacity)

                Spacer(minLength: 0)

                footer
                    .padding(.horizontal, 28)
                    .padding(.bottom, 18)
                    .opacity(contentOpacity * 0.95)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let t = toast {
                VStack {
                    Spacer()
                    LoginToastView(model: t) {
                        dismissToast()
                    }
                    .padding(.bottom, 72)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.spring(response: 0.38, dampingFraction: 0.82), value: toast?.id)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                contentOpacity = 1
            }
        }
        .onChange(of: session.lastError) { _, newValue in
            if let msg = newValue, !msg.isEmpty {
                presentToast(message: msg, isError: true)
            }
        }
#if DEBUG
        .sheet(isPresented: $showDebugSmokeSheet) {
            DebugSmokeTestSheet()
                .environmentObject(session)
        }
#endif
    }

    private var footer: some View {
        HStack(alignment: .center) {
            HStack(spacing: 6) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(LoginChrome.muted.opacity(0.9))
                Text("256-bit encrypted · CJIS-aligned")
                    .font(.system(size: 11, weight: .medium, design: .default))
                    .foregroundStyle(LoginChrome.muted.opacity(0.85))
            }

            Spacer()

            Text("Version \(appVersion)")
                .font(.system(size: 11, weight: .regular, design: .default))
                .foregroundStyle(LoginChrome.muted.opacity(0.75))
                .contextMenu {
                    Button("Reload configuration") {
                        session.reloadConfiguration()
                        presentToast(message: "Configuration reloaded from Secrets.plist and environment.", isError: false)
                    }
#if DEBUG
                    Divider()
                    Button("Developer: paste id_token…") {
                        showDebugSmokeSheet = true
                    }
#endif
                }
        }
    }

    private func openSupportContact() {
        guard let url = URL(string: "https://www.rapidcortex.us/contact") else { return }
        NSWorkspace.shared.open(url)
    }

    private func presentToast(message: String, isError: Bool) {
        toastDismissTask?.cancel()
        let newToast = ToastModel(message: message, isError: isError)
        let currentId = newToast.id
        withAnimation {
            toast = newToast
        }
        toastDismissTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_500_000_000)
            guard !Task.isCancelled, toast?.id == currentId else { return }
            dismissToast()
        }
    }

    private func dismissToast() {
        toastDismissTask?.cancel()
        toastDismissTask = nil
        withAnimation {
            toast = nil
        }
        if session.lastError != nil {
            session.lastError = nil
        }
    }

    private func signIn() async {
        isBusy = true
        session.lastError = nil
        toastDismissTask?.cancel()
        withAnimation { toast = nil }
        defer { isBusy = false }
        do {
            try await cognito.signInWithHostedUI(config: session.configuration)
            session.syncSessionFromKeychain()
            if session.isSignedIn {
                presentToast(message: "Signed in. Opening workspace…", isError: false)
            } else {
                presentToast(message: "Sign-in completed but no session was stored. Try again or contact support.", isError: true)
            }
        } catch {
            if let c = error as? CognitoWebAuthCoordinator.CognitoAuthError, case .userCancelled = c {
                presentToast(message: "Sign-in was cancelled.", isError: false)
            } else {
                let msg = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                presentToast(message: msg, isError: true)
            }
        }
    }
}

// MARK: - Debug smoke test (sheet, DEBUG only)

#if DEBUG
private struct DebugSmokeTestSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var token = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Developer: id_token smoke test")
                .font(.headline)
            Text("Paste a Cognito id_token to test the API without Hosted UI. Debug builds only.")
                .font(.caption)
                .foregroundStyle(.secondary)
            SecureField("id_token", text: $token)
            HStack {
                Button("Cancel", role: .cancel) { dismiss() }
                Spacer()
                Button("Store in Keychain") {
                    session.applyIdTokenForSmokeTest(token)
                    token = ""
                    dismiss()
                }
                .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(24)
        .frame(minWidth: 420)
    }
}
#endif
