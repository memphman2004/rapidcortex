namespace RapidCortex.Desktop.Services;

/// <summary>
/// Web workspace paths aligned with <c>apps/web/lib/navigation/role-nav.ts</c> and the dispatch top-bar manual link.
/// </summary>
public static class DesktopWorkspaceNavigation
{
    public const string OperationsManualPath = "/docs/rapidcortex-complete-manual.html";
    public const string RingConnectManualFragment = "#ch-10-ring";

    public sealed record QuickLink(string Id, string Label, string Path);

    public static string OperationsManualHref(bool includeRingChapter = false) =>
        includeRingChapter ? OperationsManualPath + RingConnectManualFragment : OperationsManualPath;

    public static bool ShowsOperationsManual(string role)
    {
        if (DesktopPostLoginRouting.IsProductVerticalRoleToken(role))
        {
            return true;
        }

        var effective = DesktopPostLoginRouting.NormalizeSessionRole(role);
        return effective switch
        {
            "dispatcher" or "supervisor" or "agencyadmin" or "agencyit" or "analyst" or "auditor"
                or "rcsuperadmin" or "rcadmin" or "rcitadmin" or "hospitaladmin" or "hospitalstaff" => true,
            _ => false,
        };
    }

    public static string RoleBadgeLabel(string role)
    {
        var effective = DesktopPostLoginRouting.NormalizeSessionRole(role);
        return effective switch
        {
            "dispatcher" => "DISPATCHER",
            "supervisor" => "SUPERVISOR",
            "agencyadmin" => "AGENCY ADMIN",
            "agencyit" => "IT ADMIN",
            "rcsuperadmin" or "rcadmin" => "RC ADMIN",
            "rcitadmin" => "RC IT",
            _ => effective.ToUpperInvariant(),
        };
    }

    public static string ResolveJurisdictionSlug(string configured, string? idToken)
    {
        var trimmed = configured.Trim();
        if (!string.IsNullOrWhiteSpace(trimmed))
        {
            return trimmed;
        }

        if (string.IsNullOrWhiteSpace(idToken))
        {
            return "example-city";
        }

        var payload = JwtPayloadParser.TryParsePayload(idToken);
        if (payload is null)
        {
            return "example-city";
        }

        var agency = JwtPayloadParser.ReadString(payload.Value, "custom:agencyId") ?? "";
        var slug = agency
            .ToLowerInvariant()
            .Replace("test-", "", StringComparison.Ordinal)
            .Replace("agency-", "", StringComparison.Ordinal);
        return string.IsNullOrWhiteSpace(slug) ? "example-city" : slug;
    }

    public static IReadOnlyList<QuickLink> QuickLinks(string role, string jurisdictionSlug)
    {
        var j = string.IsNullOrWhiteSpace(jurisdictionSlug.Trim()) ? "example-city" : jurisdictionSlug.Trim();
        if (DesktopPostLoginRouting.IsProductVerticalRoleToken(role))
        {
            return Array.Empty<QuickLink>();
        }

        var effective = DesktopPostLoginRouting.NormalizeSessionRole(role);
        return effective switch
        {
            "dispatcher" =>
            [
                new("dashboard", "Dashboard", $"/{j}/dashboard"),
                new("dispatcher", "Dispatcher", $"/{j}/dispatcher"),
                new("incidents", "Incidents", $"/{j}/incidents"),
                new("media", "Media", $"/{j}/media"),
            ],
            "supervisor" =>
            [
                new("supervisor", "Supervisor", $"/{j}/supervisor"),
                new("dashboard", "Dashboard", $"/{j}/dashboard"),
                new("incidents", "Incidents", $"/{j}/incidents"),
                new("media", "Media", $"/{j}/media"),
            ],
            "agencyadmin" or "agencyit" =>
            [
                new("admin", "Admin", $"/{j}/admin"),
                new("dashboard", "Dashboard", $"/{j}/dashboard"),
                new("media", "Media", $"/{j}/media"),
            ],
            "rcsuperadmin" or "rcadmin" or "rcitadmin" =>
            [
                new("rc-admin", "RC Admin", "/rc-admin/dashboard"),
            ],
            _ => Array.Empty<QuickLink>(),
        };
    }
}
