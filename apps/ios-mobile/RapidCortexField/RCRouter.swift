import Foundation

/// Post-login destination. JWT only — no picker, no user-facing vertical labels.
enum RCDestination {
    case qrNFC
    case dispatch
    case agencySelect
    case noAccess
}

enum RCRouter {
    static func destination(
        for claims: RCUserClaims?,
        selectedAgencyVertical: String? = nil
    ) -> RCDestination {
        guard let claims else { return .noAccess }

        switch claims.canonicalRole {
        case "campus_admin",
             "campus_supervisor",
             "campus_security",
             "campus_dispatch",
             "venue_admin",
             "venue_supervisor",
             "venue_operator",
             "venue_security",
             "venue_guest_services",
             "transit_admin",
             "transit_supervisor",
             "transit_security",
             "transit_operator":
            return .qrNFC

        case "supervisor", "dispatcher", "analyst", "auditor", "agencyit":
            return .dispatch

        case "agencyadmin":
            return destinationForAgencyVertical(claims.agencyVertical)

        case "rcsuperadmin", "rcadmin", "rcitadmin":
            if let selected = selectedAgencyVertical {
                return destinationForAgencyVertical(selected)
            }
            return .agencySelect

        default:
            return .noAccess
        }
    }

    /// Agency operational profile from Cognito — never displayed.
    static func destinationForAgencyVertical(_ vertical: String?) -> RCDestination {
        switch vertical?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "911", "psap", "city", "county", "municipality", "regional_center", "pilot", "state_agency":
            return .dispatch
        case "campus", "venue", "transit":
            return .qrNFC
        default:
            return .qrNFC
        }
    }
}
