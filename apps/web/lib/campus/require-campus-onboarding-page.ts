import { notFound, redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { normalizeCampusCode } from "@/lib/campus/campus-access";
import { canViewCampusNavItem } from "@/lib/venue/venue-nav-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";

export async function requireCampusOnboardingPage(campusCodeParam: string) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const campusCode = normalizeCampusCode(campusCodeParam);
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/app/campus/${encodeURIComponent(campusCodeParam)}`);
  if (!canViewCampusNavItem("onboarding-packets", user.role)) {
    redirect(`/app/campus/${campusCodeParam}`);
  }
  return {
    campusCode,
    orgCode: campusCode,
    agencyId: user.agencyId,
    role: user.role,
  };
}
