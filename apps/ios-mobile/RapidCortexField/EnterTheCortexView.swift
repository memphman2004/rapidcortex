import SwiftUI

enum SplashTheme {
    static let background = Color(red: 0, green: 4 / 255, blue: 14 / 255)
    static let blue = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255)
    static let red = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
    static let eyebrow = Color(red: 147 / 255, green: 197 / 255, blue: 253 / 255).opacity(0.55)
    static let tagline = Color.white.opacity(0.18)
    static let buttonBorder = Color.white.opacity(0.22)
    static let ringInner = Color.white.opacity(0.08)
    static let ringOuter = Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255).opacity(0.12)
    static let accessing = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255).opacity(0.9)
    static let statusBlue = Color(red: 147 / 255, green: 197 / 255, blue: 253 / 255).opacity(0.9)
    static let statusRed = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255).opacity(0.9)
    static let statusWhite = Color.white.opacity(0.9)
}

enum SplashGate {
    private static let key = "rc_mobile_cortex_entered_at"
    private static let ttl: TimeInterval = 24 * 60 * 60

    static func hasEnteredRecently() -> Bool {
        let at = UserDefaults.standard.double(forKey: key)
        guard at > 0 else { return false }
        return Date().timeIntervalSince1970 - at < ttl
    }

    static func markEntered() {
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: key)
    }
}

struct EnterTheCortexView: View {
    var onEnterComplete: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var accessing = false
    @State private var statusIndex = 0
    @State private var ringA = false
    @State private var ringB = false
    @State private var blinkOn = true

    private let statusMessages = [
        "NEURAL LINK ESTABLISHED",
        "CORTEX ONLINE",
        "ROUTING...",
    ]
    private var statusColors: [Color] {
        [SplashTheme.statusBlue, SplashTheme.statusRed, SplashTheme.statusWhite]
    }

    var body: some View {
        ZStack {
            SplashTheme.background.ignoresSafeArea()

            if !reduceMotion {
                NeuralFieldView()
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
            }

            VStack(spacing: 0) {
                Text("RAPID CORTEX")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(3.4)
                    .foregroundColor(SplashTheme.eyebrow)

                Text("Enter the")
                    .font(.system(size: 42, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.top, 18)
                Text("Cortex")
                    .font(.system(size: 42, weight: .bold))
                    .foregroundColor(SplashTheme.red)

                Text("INTELLIGENCE AT THE SPEED OF RESPONSE")
                    .font(.system(size: 11, weight: .regular))
                    .tracking(2.2)
                    .foregroundColor(SplashTheme.tagline)
                    .multilineTextAlignment(.center)
                    .padding(.top, 16)

                initializeButton
                    .padding(.top, 42)
            }
            .padding(.horizontal, 24)
            .zIndex(10)

            if accessing {
                SplashTheme.background
                    .ignoresSafeArea()
                    .overlay(
                        Text(statusMessages[statusIndex])
                            .font(.system(size: 15, weight: .semibold))
                            .tracking(3.5)
                            .foregroundColor(statusColors[statusIndex])
                            .opacity(blinkOn ? 1 : 0.1)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    )
                    .zIndex(30)
                    .accessibilityAddTraits(.updatesFrequently)
            }
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                ringA = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    ringB = true
                }
            }
        }
    }

    private var initializeButton: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5)
                .stroke(SplashTheme.ringOuter, lineWidth: 1)
                .padding(-28)
                .scaleEffect(ringB ? 1.07 : 1)
                .opacity(reduceMotion ? 0.2 : 1)

            RoundedRectangle(cornerRadius: 3)
                .stroke(SplashTheme.ringInner, lineWidth: 1)
                .padding(-14)
                .scaleEffect(ringA ? 1.07 : 1)
                .opacity(reduceMotion ? 0.35 : 1)

            Button(action: handleEnter) {
                Text(accessing ? "ACCESSING..." : "INITIALIZE")
                    .font(.system(size: 12, weight: .medium))
                    .tracking(3.1)
                    .foregroundColor(accessing ? SplashTheme.accessing : .white)
                    .frame(minWidth: 220)
                    .padding(.vertical, 17)
                    .padding(.horizontal, 52)
                    .overlay(
                        RoundedRectangle(cornerRadius: 2)
                            .stroke(accessing ? Color.red.opacity(0.45) : SplashTheme.buttonBorder, lineWidth: 1)
                    )
                    .overlay(cornerTicks)
            }
            .buttonStyle(.plain)
            .disabled(accessing)
            .accessibilityLabel("Initialize")
        }
        .frame(width: 280, height: 90)
    }

    private var cornerTicks: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                Path { p in
                    p.move(to: CGPoint(x: 0, y: 9))
                    p.addLine(to: CGPoint(x: 0, y: 0))
                    p.addLine(to: CGPoint(x: 9, y: 0))
                }
                .stroke(SplashTheme.red, lineWidth: 1.5)

                Path { p in
                    p.move(to: CGPoint(x: w - 9, y: 0))
                    p.addLine(to: CGPoint(x: w, y: 0))
                    p.addLine(to: CGPoint(x: w, y: 9))
                }
                .stroke(SplashTheme.blue, lineWidth: 1.5)

                Path { p in
                    p.move(to: CGPoint(x: 0, y: h - 9))
                    p.addLine(to: CGPoint(x: 0, y: h))
                    p.addLine(to: CGPoint(x: 9, y: h))
                }
                .stroke(SplashTheme.blue, lineWidth: 1.5)

                Path { p in
                    p.move(to: CGPoint(x: w - 9, y: h))
                    p.addLine(to: CGPoint(x: w, y: h))
                    p.addLine(to: CGPoint(x: w, y: h - 9))
                }
                .stroke(SplashTheme.red, lineWidth: 1.5)
            }
        }
        .allowsHitTesting(false)
    }

    private func handleEnter() {
        guard !accessing else { return }
        accessing = true
        statusIndex = 0
        startBlink()
        advanceStatus(from: 0)
    }

    private func startBlink() {
        guard !reduceMotion else { return }
        withAnimation(.easeInOut(duration: 0.2).repeatForever(autoreverses: true)) {
            blinkOn = false
        }
    }

    private func advanceStatus(from step: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.52) {
            if step >= statusMessages.count - 1 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
                    onEnterComplete()
                }
                return
            }
            statusIndex = step + 1
            advanceStatus(from: step + 1)
        }
    }
}
