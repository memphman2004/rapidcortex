import Foundation

// MARK: - JWT helpers

enum DesktopRoleRouting {
    private static let rapidCortexRoles: Set<String> = [
        "rcsuperadmin", "rcadmin", "rcitadmin",
        "agencyadmin", "agencyit", "supervisor", "dispatcher",
        "analyst", "auditor", "hospitaladmin", "hospitalstaff",
    ]

    static func jwtPayloadDictionary(_ idToken: String) -> [String: Any]? {
        let parts = idToken.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        var s = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let pad = 4 - (s.count % 4)
        if pad < 4 { s += String(repeating: "=", count: pad) }
        guard let data = Data(base64Encoded: s) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    /// Mirrors `normalizeSessionRole` in packages/shared.
    static func normalizeSessionRole(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if isProductVerticalRoleToken(trimmed) { return trimmed }
        let migrated = migrateLegacyRapidCortexRoleTokenValue(trimmed) ?? ""
        if !migrated.isEmpty, rapidCortexRoles.contains(migrated) { return migrated }
        return "dispatcher"
    }

    static func isProductVerticalRoleToken(_ raw: String) -> Bool {
        let upper = raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return upper.hasPrefix("VENUE_")
            || upper.hasPrefix("CAMPUS_")
            || upper.hasPrefix("HOSPITAL_")
            || upper.hasPrefix("TRANSIT_")
    }

    /// Mirrors `migrateLegacyRapidCortexRoleTokenValue` — product vertical tokens are preserved upstream.
    static func migrateLegacyRapidCortexRoleTokenValue(_ raw: String) -> String? {
        let t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        switch t {
        case "platform_superadmin", "superadmin", "rc_admin", "rc_superadmin": return "rcsuperadmin"
        case "admin": return "agencyadmin"
        case "it_admin": return "agencyit"
        case "commsupervisor": return "supervisor"
        case "readonly_auditor", "staff": return "auditor"
        case "hospital_admin": return "hospitaladmin"
        case "hospital_staff": return "hospitalstaff"
        default: return t
        }
    }

    static func isRapidCortexRole(_ value: String) -> Bool {
        let effective = migrateLegacyRapidCortexRoleTokenValue(value) ?? value
        return rapidCortexRoles.contains(effective)
    }

    /// Mirrors `resolveRoleClaims` in apps/web/lib/auth/verify-cognito.ts.
    static func resolveRole(from payload: [String: Any]) -> String {
        if let custom = payload["custom:role"] as? String {
            let trimmed = custom.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        if let preferred = payload["preferred_role"] as? String {
            let trimmed = preferred.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        if let groups = payload["cognito:groups"] as? [Any] {
            for g in groups {
                let segment = String(describing: g).trimmingCharacters(in: .whitespacesAndNewlines)
                guard !segment.isEmpty else { continue }
                let migrated = migrateLegacyRapidCortexRoleTokenValue(segment) ?? segment
                if isRapidCortexRole(migrated) { return migrated }
            }
        }
        return ""
    }

    static func sessionRole(fromIdToken idToken: String) -> String {
        guard let payload = jwtPayloadDictionary(idToken) else { return "dispatcher" }
        return normalizeSessionRole(resolveRole(from: payload))
    }

    // MARK: - Product + PSAP home paths (mirrors apps/web/lib/auth/post-login-redirect.ts)

    static func extractVenueCode(agencyId: String) -> String {
        let raw = agencyId.trimmingCharacters(in: .whitespacesAndNewlines)
        if let re = try? NSRegularExpression(pattern: "(?:test-)?venue-(.+)$", options: [.caseInsensitive]),
           let match = re.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)),
           match.numberOfRanges > 1,
           let range = Range(match.range(at: 1), in: raw) {
            return String(raw[range]).uppercased().replacingOccurrences(of: "-", with: "")
        }
        return raw.uppercased().replacingOccurrences(of: "-", with: "")
    }

    static func extractCampusCode(agencyId: String) -> String {
        let raw = agencyId.trimmingCharacters(in: .whitespacesAndNewlines)
        if let re = try? NSRegularExpression(pattern: "(?:test-)?campus-(.+)$", options: [.caseInsensitive]),
           let match = re.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)),
           match.numberOfRanges > 1,
           let range = Range(match.range(at: 1), in: raw) {
            return String(raw[range]).uppercased().replacingOccurrences(of: "-", with: "")
        }
        return raw.uppercased().replacingOccurrences(of: "-", with: "")
    }

    static func resolveHospitalPortalDashboardHref(role: String) -> String? {
        if isHospitalStaffPortalRole(role) { return "/hospital-staff/dashboard" }
        if isHospitalAdminPortalRole(role) { return "/hospital-admin/dashboard" }
        return nil
    }

    private static func isHospitalAdminPortalRole(_ role: String) -> Bool {
        let raw = role.trimmingCharacters(in: .whitespacesAndNewlines)
        let upper = raw.uppercased()
        if raw == "hospitaladmin" { return true }
        if upper == "HOSPITAL_ADMIN" { return true }
        if upper.hasPrefix("HOSPITAL_"), !upper.contains("STAFF") { return true }
        return (migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) == "hospitaladmin"
    }

    private static func isHospitalStaffPortalRole(_ role: String) -> Bool {
        let raw = role.trimmingCharacters(in: .whitespacesAndNewlines)
        let upper = raw.uppercased()
        if raw == "hospitalstaff" { return true }
        if upper == "HOSPITAL_STAFF" { return true }
        if upper.hasPrefix("HOSPITAL_"), upper.contains("STAFF") { return true }
        return (migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) == "hospitalstaff"
    }

    static func resolveProductDashboardFromRoleAndAgency(role: String, agencyId: String) -> String? {
        let roleToken = role.trimmingCharacters(in: .whitespacesAndNewlines)
        let roleUpper = roleToken.uppercased()
        let agency = agencyId.trimmingCharacters(in: .whitespacesAndNewlines)

        if roleUpper.hasPrefix("VENUE_") {
            return "/app/venue/\(extractVenueCode(agency: agency))"
        }
        if roleUpper.hasPrefix("CAMPUS_") {
            return "/app/campus/\(extractCampusCode(agency: agency))"
        }
        if let hospital = resolveHospitalPortalDashboardHref(role: roleToken) {
            return hospital
        }
        if roleUpper.hasPrefix("TRANSIT_") {
            return "/app/transit"
        }
        let normalized = normalizeSessionRole(roleToken)
        if normalized == "rcsuperadmin" || normalized == "rcadmin" {
            return "/rc-admin/dashboard"
        }
        if normalized == "rcitadmin" {
            return "/rc-admin/infrastructure"
        }
        return nil
    }

    /// Mirrors `jurisdictionRoleHomeHref` in apps/web/lib/auth/role-home.ts
    static func jurisdictionRoleHomeHref(role: String, jurisdictionSlug: String) -> String {
        let effective = normalizeSessionRole(role)
        let j = jurisdictionSlug.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyOrNil ?? "example-city"

        if effective == "rcsuperadmin" { return "/rc-admin/dashboard" }
        if effective == "rcitadmin" { return "/rc-admin/infrastructure" }
        if effective == "rcadmin" { return "/rc-admin/dashboard" }

        switch effective {
        case "dispatcher": return "/\(j)/dashboard"
        case "supervisor": return "/\(j)/supervisor"
        case "agencyadmin": return "/\(j)/admin"
        case "agencyit": return "/\(j)/admin/it"
        case "analyst": return "/\(j)/analytics"
        case "auditor": return "/\(j)/audit"
        case "hospitaladmin": return "/hospital-admin/dashboard"
        case "hospitalstaff": return "/hospital-staff/dashboard"
        default: return "/\(j)/dashboard"
        }
    }

    /// Canonical web path after desktop sign-in (aligned with `resolvePostAuthenticationHomeHrefAfterPasswordChange`).
    static func desktopPostLoginWebPath(idToken: String, jurisdictionSlug: String) -> String {
        guard let payload = jwtPayloadDictionary(idToken) else {
            let j = jurisdictionSlug.trimmingCharacters(in: .whitespacesAndNewlines).nonEmptyOrNil ?? "example-city"
            return "/\(j)/dashboard"
        }
        let rawRole = resolveRole(from: payload)
        let role = normalizeSessionRole(rawRole)
        let agencyId = (payload["custom:agencyId"] as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if let product = resolveProductDashboardFromRoleAndAgency(role: rawRole, agencyId: agencyId) {
            return product
        }
        if role == "rcsuperadmin" {
            return "/rc-admin/dashboard"
        }
        let slug = jurisdictionSlug.trimmingCharacters(in: .whitespacesAndNewlines)
        let j = slug.isEmpty ? "example-city" : slug
        return jurisdictionRoleHomeHref(role: role, jurisdictionSlug: j)
    }

    // MARK: - Native toolbar (PSAP-only tools)

    struct NativeToolbarAccess {
        let showCommandMap: Bool
        let showHospitalRouting: Bool
    }

    /// PSAP live-ops native tools — hidden for venue/campus/hospital/QA/executive/admin roles.
    static func nativeToolbarAccess(forRole role: String) -> NativeToolbarAccess {
        if isProductVerticalRoleToken(role) {
            return NativeToolbarAccess(showCommandMap: false, showHospitalRouting: false)
        }
        let effective = normalizeSessionRole(role)
        switch effective {
        case "dispatcher", "supervisor":
            return NativeToolbarAccess(showCommandMap: true, showHospitalRouting: true)
        case "rcsuperadmin", "rcadmin", "rcitadmin":
            return NativeToolbarAccess(showCommandMap: false, showHospitalRouting: true)
        default:
            return NativeToolbarAccess(showCommandMap: false, showHospitalRouting: false)
        }
    }

    static func nativeToolbarAccess(fromIdToken idToken: String) -> NativeToolbarAccess {
        nativeToolbarAccess(forRole: sessionRole(fromIdToken: idToken))
    }
}

private extension String {
    var nonEmptyOrNil: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
