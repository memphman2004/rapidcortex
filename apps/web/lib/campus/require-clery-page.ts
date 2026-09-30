import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isCleryModuleEnabled } from "@/lib/runtime-flags";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";
import { campusSettingsFromAgency } from "@/lib/campus/campus-settings-mapper";
import type { AgencyTenant } from "rapid-cortex-shared";

export async function requireCleryPage(
  campusCode: string,
  navKey: string,
): Promise<{ campusCode: string; role: string; agencyId: string }> {
  if (!isCleryModuleEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  const agencyId = user?.agencyId ?? "";

  if (agencyId) {
    try {
      const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}`);
      if (res.ok) {
        const raw = (await res.json()) as AgencyTenant & { data?: AgencyTenant };
        const agency = (raw.data ?? raw) as AgencyTenant;
        const institutionType = campusSettingsFromAgency(agency).general.institutionType;
        if (institutionType === "k12") {
          if (navKey === "clery-dcl") {
            redirect(`/app/campus/${campusCode}/reports/incidents`);
          }
          redirect(`/app/campus/${campusCode}/reports/school-safety`);
        }
      }
    } catch {
      // Fall through to Clery access check when agency cannot be loaded.
    }
  }

  if (!canViewCampusNavItem(navKey, role)) redirect(`/app/campus/${campusCode}`);
  return { campusCode, role, agencyId };
}
