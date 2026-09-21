import SwiftUI
import UIKit

struct LoginView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 60)

                    VStack(spacing: 8) {
                        Image("RCLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 88, height: 88)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .accessibilityLabel("Rapid Cortex")

                        Text("Rapid Cortex Mobile")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(RCTheme.textPrimary)
                    }
                    .padding(.bottom, 36)

                    VStack(spacing: 12) {
                        RCTextField(
                            text: $email,
                            placeholder: "admin@agency.us",
                            label: "Email",
                            keyboardType: .emailAddress,
                            textContentType: .username,
                            autocapitalization: .never
                        )
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }

                        RCTextField(
                            text: $password,
                            placeholder: "Password",
                            label: "Password",
                            isSecure: true,
                            textContentType: .password
                        )
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { signIn() }

                        if let error = auth.error {
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundColor(RCTheme.danger)
                                .padding(.horizontal, 4)
                        }

                        Button(action: signIn) {
                            HStack {
                                if auth.isLoading {
                                    ProgressView()
                                        .progressViewStyle(.circular)
                                        .tint(.white)
                                } else {
                                    Text("Sign in")
                                        .font(.system(size: 15, weight: .semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(auth.isLoading ? RCTheme.accent.opacity(0.7) : RCTheme.accent)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(auth.isLoading || email.isEmpty || password.isEmpty)
                        .animation(.easeInOut(duration: 0.15), value: auth.isLoading)
                    }
                    .padding(.horizontal, 24)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Accounts are provisioned by your agency during onboarding. There is no in-app sign-up.")
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        HStack(spacing: 16) {
                            Link("Privacy Policy", destination: RCConfig.privacyPolicyURL)
                            Link("Terms of Use", destination: RCConfig.termsOfUseURL)
                        }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(RCTheme.accentLight)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RCTheme.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.border, lineWidth: 0.5))
                    .padding(.horizontal, 24)
                    .padding(.top, 20)

                    Spacer(minLength: 40)
                }
            }
        }
        .sheet(isPresented: $auth.requiresMFA) {
            MFAView()
                .environmentObject(auth)
        }
        .sheet(isPresented: $auth.requiresMFASetup) {
            MFASetupView()
                .environmentObject(auth)
                .interactiveDismissDisabled()
        }
    }

    private func signIn() {
        guard !email.isEmpty, !password.isEmpty else { return }
        focus = nil
        Task { await auth.signIn(email: email, password: password) }
    }
}

struct MFAView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 40))
                    .foregroundColor(RCTheme.accentLight)
                    .padding(.top, 40)

                Text("Two-factor authentication")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(RCTheme.textPrimary)

                Text("Enter the 6-digit code from your authenticator app.")
                    .font(.system(size: 13))
                    .foregroundColor(RCTheme.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                TextField("000000", text: $auth.mfaCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 28, weight: .semibold, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .focused($focused)
                    .onChange(of: auth.mfaCode) { value in
                        if value.count == 6 { Task { await auth.submitMFA() } }
                    }
                    .padding()
                    .background(RCTheme.surface1)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 40)

                if let error = auth.error {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.danger)
                }

                Button(action: { Task { await auth.submitMFA() } }) {
                    Text(auth.isLoading ? "Verifying…" : "Verify")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(auth.mfaCode.count == 6 ? RCTheme.accent : RCTheme.surface1)
                        .foregroundColor(auth.mfaCode.count == 6 ? .white : RCTheme.textMuted)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(auth.mfaCode.count < 6 || auth.isLoading)
                .padding(.horizontal, 24)

                Spacer()
            }
        }
        .onAppear { focused = true }
    }
}

struct MFASetupView: View {
    @EnvironmentObject var auth: CognitoAuthManager
    @FocusState private var focused: Bool
    @State private var copied = false

    var body: some View {
        ZStack {
            RCTheme.bg.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 36))
                        .foregroundColor(RCTheme.accentLight)
                        .padding(.top, 28)

                    Text("Set up authenticator")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(RCTheme.textPrimary)

                    Text("Scan this QR with Google Authenticator, 1Password, or iOS Passwords. Then enter the 6-digit code to finish sign-in.")
                        .font(.system(size: 13))
                        .foregroundColor(RCTheme.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)

                    if let image = qrImage {
                        Image(uiImage: image)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 200, height: 200)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .accessibilityLabel("Authenticator QR code")
                    }

                    VStack(spacing: 6) {
                        Text("Or enter this key")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(RCTheme.textMuted)
                            .textCase(.uppercase)
                            .tracking(0.5)

                        Text(groupedSecret)
                            .font(.system(size: 15, weight: .semibold, design: .monospaced))
                            .foregroundColor(RCTheme.textPrimary)
                            .multilineTextAlignment(.center)
                            .textSelection(.enabled)

                        Button {
                            UIPasteboard.general.string = auth.totpSecret
                            copied = true
                        } label: {
                            Text(copied ? "Copied" : "Copy key")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(RCTheme.accentLight)
                        }
                        .accessibilityLabel("Copy authenticator key")
                    }
                    .padding(.horizontal, 24)

                    TextField("000000", text: $auth.mfaCode)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .font(.system(size: 28, weight: .semibold, design: .monospaced))
                        .multilineTextAlignment(.center)
                        .focused($focused)
                        .onChange(of: auth.mfaCode) { value in
                            let digits = String(value.filter(\.isNumber).prefix(6))
                            if digits != value { auth.mfaCode = digits }
                            if digits.count == 6 { Task { await auth.submitMFASetup() } }
                        }
                        .padding()
                        .background(RCTheme.surface1)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal, 40)

                    if let error = auth.error {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundColor(RCTheme.danger)
                            .padding(.horizontal, 24)
                    }

                    Button(action: { Task { await auth.submitMFASetup() } }) {
                        Text(auth.isLoading ? "Verifying…" : "Complete setup")
                            .font(.system(size: 15, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(auth.mfaCode.count == 6 ? RCTheme.accent : RCTheme.surface1)
                            .foregroundColor(auth.mfaCode.count == 6 ? .white : RCTheme.textMuted)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(auth.mfaCode.count < 6 || auth.isLoading)
                    .padding(.horizontal, 24)

                    Button("Cancel") {
                        auth.cancelPendingChallenge()
                    }
                    .font(.system(size: 14))
                    .foregroundColor(RCTheme.textSecondary)
                    .padding(.bottom, 28)
                }
            }
        }
        .onAppear { focused = true }
    }

    private var qrImage: UIImage? {
        guard let payload = auth.totpOtpauthURL else { return nil }
        return QRCodeGenerator.generate(payload: payload, size: 512)
    }

    private var groupedSecret: String {
        let raw = auth.totpSecret.filter { !$0.isWhitespace }
        return stride(from: 0, to: raw.count, by: 4).map { start in
            let i = raw.index(raw.startIndex, offsetBy: start)
            let j = raw.index(i, offsetBy: 4, limitedBy: raw.endIndex) ?? raw.endIndex
            return String(raw[i..<j])
        }.joined(separator: " ")
    }
}

struct RCTextField: View {
    @Binding var text: String
    var placeholder: String
    var label: String
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences

    @State private var isPasswordVisible = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(RCTheme.textMuted)
                .textCase(.uppercase)
                .tracking(0.5)

            HStack(spacing: 0) {
                Group {
                    if isSecure && !isPasswordVisible {
                        SecureField(placeholder, text: $text)
                            .textContentType(textContentType)
                    } else {
                        TextField(placeholder, text: $text)
                            .keyboardType(isSecure ? .default : keyboardType)
                            .textContentType(textContentType)
                            .textInputAutocapitalization(isSecure ? .never : autocapitalization)
                            .autocorrectionDisabled()
                    }
                }
                .font(.system(size: 15))
                .foregroundColor(RCTheme.textPrimary)

                if isSecure {
                    Button {
                        isPasswordVisible.toggle()
                    } label: {
                        Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(RCTheme.textSecondary)
                            .frame(width: 36, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(isPasswordVisible ? "Hide password" : "Show password")
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, isSecure ? 4 : 12)
            .frame(height: 44)
            .background(RCTheme.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.border, lineWidth: 0.5))
        }
    }
}
