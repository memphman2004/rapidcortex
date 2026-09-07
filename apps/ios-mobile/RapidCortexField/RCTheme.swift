import SwiftUI
import UIKit

enum RCTheme {
    static let amber = Color(hex: "#F59E0B")
    static let amberMuted = Color(hex: "#FBBF24")
    static let brandBlue = Color(hex: "#1B4FD8")
    static let brandRed = Color(hex: "#CC1F25")
    static let accent = amber
    static let accentLight = amberMuted
    static let success = Color(hex: "#10B981")
    static let warning = Color(hex: "#F59E0B")
    static let danger = Color(hex: "#EF4444")

    static let bg = Color(hex: "#0A0F1E")
    static let surface1 = Color(hex: "#111827")
    static let surface2 = Color(hex: "#1A2236")
    static let border = Color(hex: "#1E2D4A")

    static let textPrimary = Color(hex: "#F1F5F9")
    static let textSecondary = Color(hex: "#94A3B8")
    static let textMuted = Color(hex: "#475569")

    static let printClose = Color(hex: "#1B4FD8")
    static let printText = Color(hex: "#0A0F1E")
    static let printMuted = Color(hex: "#6B7280")
    static let printRule = Color(hex: "#E2E8F0")

    static func verticalColor(_ vertical: String) -> (bg: Color, fg: Color) {
        switch vertical.lowercased() {
        case "campus": return (Color(hex: "#111827"), Color(hex: "#94A3B8"))
        case "venue": return (Color(hex: "#1A1408"), amber)
        case "transit": return (Color(hex: "#0A1A3A"), Color(hex: "#38BDF8"))
        case "911", "core": return (Color(hex: "#2A0808"), danger)
        default: return (surface2, textSecondary)
        }
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 1; g = 1; b = 1
        }
        self.init(red: r, green: g, blue: b)
    }
}

enum RCBadgeTone {
    case accent, success, warning, danger, neutral
}

struct RCBadge: View {
    let label: String
    var tone: RCBadgeTone = .neutral
    var small: Bool = false

    private var color: Color {
        switch tone {
        case .accent: return RCTheme.amber
        case .success: return RCTheme.success
        case .warning: return RCTheme.amber
        case .danger: return RCTheme.danger
        case .neutral: return RCTheme.textSecondary
        }
    }

    var body: some View {
        Text(label)
            .font(.system(size: small ? 11 : 13, weight: .semibold))
            .foregroundColor(color)
            .padding(.horizontal, small ? 8 : 12)
            .padding(.vertical, small ? 3 : 6)
            .background(tone == .neutral ? RCTheme.surface2 : color.opacity(0.12))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color, lineWidth: 1))
    }
}

struct RCField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var helper: String? = nil

    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(RCTheme.textPrimary)
            TextField(placeholder, text: $text)
                .font(.system(size: 16))
                .foregroundColor(RCTheme.textPrimary)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .phonePad ? .never : .words)
                .autocorrectionDisabled()
                .focused($focused)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(RCTheme.surface1)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(focused ? RCTheme.textPrimary : RCTheme.border, lineWidth: 1)
                )
            if let helper {
                Text(helper)
                    .font(.system(size: 12))
                    .foregroundColor(RCTheme.textMuted)
            }
        }
    }
}

struct RCPrimaryButton: View {
    let title: String
    var enabled: Bool = true
    var loading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading {
                    ProgressView().tint(.white)
                } else {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundColor(.white)
            .background(enabled && !loading ? RCTheme.amber : RCTheme.amber.opacity(0.45))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(!enabled || loading)
    }
}

struct RCSecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .foregroundColor(RCTheme.textPrimary)
                .background(RCTheme.surface2)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(RCTheme.border, lineWidth: 1))
        }
    }
}

struct RCCard<Content: View>: View {
    var action: (() -> Void)?
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if let action {
                Button(action: action) { card }
                    .buttonStyle(.plain)
            } else {
                card
            }
        }
    }

    private var card: some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
    }
}

enum RCFormat {
    static func phone(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        let core: String
        if digits.count == 11, digits.first == "1" {
            core = String(digits.dropFirst())
        } else {
            core = digits
        }
        guard core.count == 10 else { return raw }
        let area = core.prefix(3)
        let mid = core.dropFirst(3).prefix(3)
        let last = core.suffix(4)
        return "(\(area)) \(mid)-\(last)"
    }

    static func relative(_ iso: String) -> String? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: iso)
        }()
        guard let date else { return nil }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .full
        return rel.localizedString(for: date, relativeTo: Date())
    }

    static func reportTypeLabel(_ value: String) -> String {
        switch value.lowercased() {
        case "anonymous": return "Anonymous"
        case "identified": return "Identified"
        default: return "Both"
        }
    }
}

struct RCCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(RCTheme.surface1)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(RCTheme.border, lineWidth: 1))
    }
}

extension View {
    func rcCard() -> some View { modifier(RCCardModifier()) }
}
