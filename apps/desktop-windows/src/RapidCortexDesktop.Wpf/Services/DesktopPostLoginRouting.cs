using System.Text.Json;
using System.Text.RegularExpressions;

namespace RapidCortex.Desktop.Services;

/// <summary>
/// Post-login web paths aligned with <c>apps/web/lib/auth/post-login-redirect.ts</c>
/// and <c>packages/shared/src/auth/rapid-cortex-roles.ts</c>.
/// </summary>
public static class DesktopPostLoginRouting
{
    private static readonly HashSet<string> RapidCortexRoles = new(StringComparer.Ordinal)
    {
        "rcsuperadmin", "rcadmin", "rcitadmin",
        "agencyadmin", "agencyit", "supervisor", "dispatcher",
        "analyst", "auditor", "hospitaladmin", "hospitalstaff",
    };

    public sealed record NativeToolbarAccess(bool ShowCommandMap, bool ShowHospitalRouting);

    public static string DesktopPostLoginWebPath(string idToken, string jurisdictionSlug)
    {
        var payload = JwtPayloadParser.TryParsePayload(idToken);
        if (payload is null)
        {
            var j = NormalizeSlug(jurisdictionSlug);
            return $"/{j}/dashboard";
        }

        var root = payload.Value;
        var rawRole = ResolveRole(root);
        var role = NormalizeSessionRole(rawRole);
        var agencyId = JwtPayloadParser.ReadString(root, "custom:agencyId") ?? "";

        var product = ResolveProductDashboardFromRoleAndAgency(rawRole, agencyId);
        if (product is not null)
        {
            return product;
        }

        if (role == "rcsuperadmin")
        {
            return "/rc-admin/dashboard";
        }

        return JurisdictionRoleHomeHref(role, NormalizeSlug(jurisdictionSlug));
    }

    public static NativeToolbarAccess NativeToolbarAccessForRole(string role)
    {
        if (IsProductVerticalRoleToken(role))
        {
            return new NativeToolbarAccess(false, false);
        }

        var effective = NormalizeSessionRole(role);
        return effective switch
        {
            "dispatcher" or "supervisor" => new NativeToolbarAccess(true, true),
            "rcsuperadmin" or "rcadmin" or "rcitadmin" => new NativeToolbarAccess(false, true),
            _ => new NativeToolbarAccess(false, false),
        };
    }

    public static NativeToolbarAccess NativeToolbarAccessFromIdToken(string idToken)
    {
        var payload = JwtPayloadParser.TryParsePayload(idToken);
        if (payload is null)
        {
            return new NativeToolbarAccess(false, false);
        }

        var rawRole = ResolveRole(payload.Value);
        return NativeToolbarAccessForRole(rawRole);
    }

    public static string SessionRoleFromIdToken(string idToken)
    {
        var payload = JwtPayloadParser.TryParsePayload(idToken);
        if (payload is null)
        {
            return "dispatcher";
        }

        return NormalizeSessionRole(ResolveRole(payload.Value));
    }

    private static string NormalizeSlug(string jurisdictionSlug)
    {
        var slug = jurisdictionSlug.Trim();
        return string.IsNullOrWhiteSpace(slug) ? "example-city" : slug;
    }

    /// <summary>Mirrors <c>normalizeSessionRole</c> in shared package.</summary>
    public static string NormalizeSessionRole(string raw)
    {
        var trimmed = raw.Trim();
        if (IsProductVerticalRoleToken(trimmed))
        {
            return trimmed;
        }

        var migrated = MigrateLegacyRapidCortexRoleTokenValue(trimmed) ?? "";
        if (!string.IsNullOrEmpty(migrated) && RapidCortexRoles.Contains(migrated))
        {
            return migrated;
        }

        return "dispatcher";
    }

    public static bool IsProductVerticalRoleToken(string raw)
    {
        var upper = raw.Trim().ToUpperInvariant();
        return upper.StartsWith("VENUE_", StringComparison.Ordinal)
            || upper.StartsWith("CAMPUS_", StringComparison.Ordinal)
            || upper.StartsWith("HOSPITAL_", StringComparison.Ordinal)
            || upper.StartsWith("TRANSIT_", StringComparison.Ordinal);
    }

    /// <summary>Mirrors <c>resolveRoleClaims</c> in apps/web/lib/auth/verify-cognito.ts.</summary>
    private static string ResolveRole(JsonElement payload)
    {
        var custom = JwtPayloadParser.ReadString(payload, "custom:role");
        if (!string.IsNullOrWhiteSpace(custom))
        {
            return custom;
        }

        var preferred = JwtPayloadParser.ReadString(payload, "preferred_role");
        if (!string.IsNullOrWhiteSpace(preferred))
        {
            return preferred;
        }

        foreach (var segment in JwtPayloadParser.ReadStringArray(payload, "cognito:groups"))
        {
            var migrated = MigrateLegacyRapidCortexRoleTokenValue(segment) ?? segment;
            if (IsRapidCortexRole(migrated))
            {
                return migrated;
            }
        }

        return "";
    }

    private static bool IsRapidCortexRole(string value)
    {
        var effective = MigrateLegacyRapidCortexRoleTokenValue(value) ?? value;
        return RapidCortexRoles.Contains(effective);
    }

    private static string? MigrateLegacyRapidCortexRoleTokenValue(string raw)
    {
        var t = raw.Trim();
        if (string.IsNullOrEmpty(t))
        {
            return null;
        }

        return t switch
        {
            "platform_superadmin" or "superadmin" or "rc_admin" or "rc_superadmin" => "rcsuperadmin",
            "admin" => "agencyadmin",
            "it_admin" => "agencyit",
            "commsupervisor" => "supervisor",
            "readonly_auditor" or "staff" => "auditor",
            "hospital_admin" => "hospitaladmin",
            "hospital_staff" => "hospitalstaff",
            _ => t,
        };
    }

    private static string ExtractVenueCode(string agencyId)
    {
        var raw = agencyId.Trim();
        var match = Regex.Match(raw, @"(?:test-)?venue-(.+)$", RegexOptions.IgnoreCase);
        return (match.Success ? match.Groups[1].Value : raw).ToUpperInvariant().Replace("-", "", StringComparison.Ordinal);
    }

    private static string ExtractCampusCode(string agencyId)
    {
        var raw = agencyId.Trim();
        var match = Regex.Match(raw, @"(?:test-)?campus-(.+)$", RegexOptions.IgnoreCase);
        return (match.Success ? match.Groups[1].Value : raw).ToUpperInvariant().Replace("-", "", StringComparison.Ordinal);
    }

    private static string? ResolveHospitalPortalDashboardHref(string role)
    {
        if (IsHospitalStaffPortalRole(role))
        {
            return "/hospital-staff/dashboard";
        }

        if (IsHospitalAdminPortalRole(role))
        {
            return "/hospital-admin/dashboard";
        }

        return null;
    }

    private static bool IsHospitalAdminPortalRole(string role)
    {
        var raw = role.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            return false;
        }

        var upper = raw.ToUpperInvariant();
        if (raw == "hospitaladmin")
        {
            return true;
        }

        if (upper == "HOSPITAL_ADMIN")
        {
            return true;
        }

        if (upper.StartsWith("HOSPITAL_", StringComparison.Ordinal) && !upper.Contains("STAFF", StringComparison.Ordinal))
        {
            return true;
        }

        return (MigrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) == "hospitaladmin";
    }

    private static bool IsHospitalStaffPortalRole(string role)
    {
        var raw = role.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            return false;
        }

        var upper = raw.ToUpperInvariant();
        if (raw == "hospitalstaff")
        {
            return true;
        }

        if (upper == "HOSPITAL_STAFF")
        {
            return true;
        }

        if (upper.StartsWith("HOSPITAL_", StringComparison.Ordinal) && upper.Contains("STAFF", StringComparison.Ordinal))
        {
            return true;
        }

        return (MigrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) == "hospitalstaff";
    }

    private static string? ResolveProductDashboardFromRoleAndAgency(string role, string agencyId)
    {
        var roleToken = role.Trim();
        var roleUpper = roleToken.ToUpperInvariant();
        var agency = agencyId.Trim();

        if (roleUpper.StartsWith("VENUE_", StringComparison.Ordinal))
        {
            return $"/app/venue/{ExtractVenueCode(agency)}";
        }

        if (roleUpper.StartsWith("CAMPUS_", StringComparison.Ordinal))
        {
            return $"/app/campus/{ExtractCampusCode(agency)}";
        }

        var hospital = ResolveHospitalPortalDashboardHref(roleToken);
        if (hospital is not null)
        {
            return hospital;
        }

        if (roleUpper.StartsWith("TRANSIT_", StringComparison.Ordinal))
        {
            return "/app/transit";
        }

        if (roleToken is "rcsuperadmin" or "rcadmin")
        {
            return "/rc-admin/dashboard";
        }

        if (roleToken == "rcitadmin")
        {
            return "/rc-admin/infrastructure";
        }

        return null;
    }

    /// <summary>Mirrors <c>jurisdictionRoleHomeHref</c> in apps/web/lib/auth/role-home.ts.</summary>
    private static string JurisdictionRoleHomeHref(string role, string jurisdictionSlug)
    {
        var effective = NormalizeSessionRole(role);

        if (effective == "rcsuperadmin")
        {
            return "/rc-admin/dashboard";
        }

        if (effective == "rcitadmin")
        {
            return "/rc-admin/infrastructure";
        }

        if (effective is "rcadmin")
        {
            return "/rc-admin/dashboard";
        }

        return effective switch
        {
            "dispatcher" => $"/{jurisdictionSlug}/dashboard",
            "supervisor" => $"/{jurisdictionSlug}/supervisor",
            "agencyadmin" => $"/{jurisdictionSlug}/admin",
            "agencyit" => $"/{jurisdictionSlug}/admin/it",
            "analyst" => $"/{jurisdictionSlug}/analytics",
            "auditor" => $"/{jurisdictionSlug}/audit",
            "hospitaladmin" => "/hospital-admin/dashboard",
            "hospitalstaff" => "/hospital-staff/dashboard",
            _ => $"/{jurisdictionSlug}/dashboard",
        };
    }
}
