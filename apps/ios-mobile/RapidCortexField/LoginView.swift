import SwiftUI

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

                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.shield.fill")
                            .font(.system(size: 12))
                            .foregroundColor(RCTheme.accentLight)
                        Text("MFA via Authenticator required for admin accounts")
                            .font(.system(size: 11))
                            .foregroundColor(RCTheme.textMuted)
                    }
                    .padding(12)
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
