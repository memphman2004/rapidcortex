import Foundation

/// Web workspace paths aligned with `apps/web/lib/navigation/role-nav.ts` and top-bar manual link.
enum DesktopWorkspaceNav {
    static let operationsManualPath = "/docs/rapidcortex-complete-manual.html"
    static let ringConnectManualFragment = "#ch-10-ring"

    struct QuickLink: Identifiable, Hashable {
        let id: String
        let label: String
        let path: String
    }

    static func operationsManualHref(includeRingChapter: Bool = false) -> String {
        includeRingChapter
            ? operationsManualPath + ringConnectManualFragment
            : operationsManualPath
    }

    /// Mirrors `hasSubscriberManualAccess` for PSAP / RC operator roles (desktop users).
    static func showsOperationsManual(forRole role: String) -> Bool {
        if DesktopRoleRouting.isProductVerticalRoleToken(role) { return true }
        let effective = DesktopRoleRouting.normalizeSessionRole(role)
        switch effective {
        case "dispatcher", "supervisor", "agencyadmin", "agencyit", "analyst", "auditor",
             "rcsuperadmin", "rcadmin", "rcitadmin", "hospitaladmin", "hospitalstaff":
            return true
        default:
            return false
        }
    }

    static func roleBadgeLabel(forRole role: String) -> String {
        let effective = DesktopRoleRouting.normalizeSessionRole(role)
        switch effective {
        case "dispatcher": return "DISPATCHER"
        case "supervisor": return "SUPERVISOR"
        case "agencyadmin": return "AGENCY ADMIN"
        case "agencyit": return "IT ADMIN"
        case "rcsuperadmin", "rcadmin": return "RC ADMIN"
        case "rcitadmin": return "RC IT"
        default:
            return effective.uppercased()
        }
    }

    static func resolveJurisdictionSlug(configured: String, idToken: String?) -> String {
        let trimmed = configured.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        guard let token = idToken,
              let payload = DesktopRoleRouting.jwtPayloadDictionary(token),
              let agency = payload["custom:agencyId"] as? String else {
            return "example-city"
        }
        let slug = agency
            .lowercased()
            .replacingOccurrences(of: "test-", with: "")
            .replacingOccurrences(of: "agency-", with: "")
        return slug.isEmpty ? "example-city" : slug
    }

    /// Compact toolbar links mirroring dispatcher/supervisor side nav (web app).
    static func quickLinks(role: String, jurisdictionSlug: String) -> [QuickLink] {
        let j = jurisdictionSlug.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyOrNil ?? "example-city"
        let effective = DesktopRoleRouting.normalizeSessionRole(role)

        if DesktopRoleRouting.isProductVerticalRoleToken(role) {
            return []
        }

        switch effective {
        case "dispatcher":
            return [
                QuickLink(id: "dashboard", label: "Dashboard", path: "/\(j)/dashboard"),
                QuickLink(id: "dispatcher", label: "Dispatcher", path: "/\(j)/dispatcher"),
                QuickLink(id: "incidents", label: "Incidents", path: "/\(j)/incidents"),
                QuickLink(id: "media", label: "Media", path: "/\(j)/media"),
            ]
        case "supervisor":
            return [
                QuickLink(id: "supervisor", label: "Supervisor", path: "/\(j)/supervisor"),
                QuickLink(id: "dashboard", label: "Dashboard", path: "/\(j)/dashboard"),
                QuickLink(id: "incidents", label: "Incidents", path: "/\(j)/incidents"),
                QuickLink(id: "media", label: "Media", path: "/\(j)/media"),
            ]
        case "agencyadmin", "agencyit":
            return [
                QuickLink(id: "admin", label: "Admin", path: "/\(j)/admin"),
                QuickLink(id: "dashboard", label: "Dashboard", path: "/\(j)/dashboard"),
                QuickLink(id: "media", label: "Media", path: "/\(j)/media"),
            ]
        case "rcsuperadmin", "rcadmin", "rcitadmin":
            return [
                QuickLink(id: "rc-admin", label: "RC Admin", path: "/rc-admin/dashboard"),
            ]
        default:
            return [
                QuickLink(id: "dashboard", label: "Dashboard", path: "/\(j)/dashboard"),
            ]
        }
    }
}

private extension String {
    var nonEmptyOrNil: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
