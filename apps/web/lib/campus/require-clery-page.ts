import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isCleryModuleEnabled } from "@/lib/runtime-flags";

export async function requireCleryPage(
  campusCode: string,
  navKey: string,
): Promise<{ campusCode: string; role: string; agencyId: string }> {
  if (!isCleryModuleEnabled()) redirect(`/app/campus/${campusCode}`);
  const user = await getDashboardSessionUser();
  const role = user?.role ?? "CAMPUS_SECURITY";
  if (!canViewCampusNavItem(navKey, role)) redirect(`/app/campus/${campusCode}`);
  return { campusCode, role, agencyId: user?.agencyId ?? "" };
}
