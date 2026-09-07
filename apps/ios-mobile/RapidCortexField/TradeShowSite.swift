import Foundation

/// Booth / Rapid Cortex marketing signs open the public site — not a location report form.
/// Matches `packages/shared/src/qr-nfc/trade-show.ts`.
enum TradeShowSite {
    static let agencyId = "rapid-cortex-platform"
    static let appOrigin = "https://app.rapidcortex.us"
    static let homeURL = "https://www.rapidcortex.us"
    static let demoURL = "https://www.rapidcortex.us/demo/"

    enum Destination: String, CaseIterable, Identifiable {
        case home
        case demo

        var id: String { rawValue }

        var label: String {
            switch self {
            case .home: return "Home"
            case .demo: return "Demo"
            }
        }

        var landingURL: String {
            switch self {
            case .home: return TradeShowSite.homeURL
            case .demo: return TradeShowSite.demoURL
            }
        }

        var landingHost: String {
            landingURL.replacingOccurrences(of: "https://", with: "")
        }

        var qrId: String {
            switch self {
            case .home: return "site-home"
            case .demo: return "site-demo"
            }
        }

        var displayName: String {
            switch self {
            case .home: return "Rapid Cortex site — Home"
            case .demo: return "Rapid Cortex site — Demo"
            }
        }

        func scanURL(medium: String) -> String {
            "\(TradeShowSite.appOrigin)/go/site/\(rawValue)?medium=\(medium)"
        }

        var qrURL: URL { URL(string: scanURL(medium: "qr"))! }
        var nfcURL: URL { URL(string: scanURL(medium: "nfc"))! }

        var fileName: String {
            switch self {
            case .home: return "rc-trade-show-home.png"
            case .demo: return "rc-trade-show-demo.png"
            }
        }

        func asCode() -> QRNFCCode {
            QRNFCCode(
                qrId: qrId,
                agencyId: TradeShowSite.agencyId,
                agencyName: "Rapid Cortex",
                name: displayName,
                vertical: "core",
                reportType: "both",
                nfcEnabled: true,
                active: true,
                url: nfcURL.absoluteString,
                scanCount: 0,
                nfcTapCount: 0,
                totalEngagements: 0,
                createdBy: "",
                createdByRole: "",
                createdAt: "",
                updatedAt: "",
                locationName: displayName,
                building: nil,
                floor: nil,
                zone: "Marketing",
                zoneCode: nil,
                smsNumber: nil,
                nfcWriteLog: [],
                lastActivityAt: nil
            )
        }
    }
}
