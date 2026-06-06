import { redirect } from "next/navigation";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { jurisdictionRoleHomeHrefForUser } from "@/lib/auth/role-home";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";

/** Legacy `/hospital-portal` entry — routes to role-specific dashboards. */
export default async function HospitalPortalPage() {
  if (!isHospitalPortalEnabled()) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login?returnTo=/hospital-portal");
  }

  const effective = migrateLegacyRapidCortexRoleTokenValue(user.role) ?? user.role;
  const home = jurisdictionRoleHomeHrefForUser(user, defaultJurisdictionSlug());
  if (effective === "hospitaladmin" || effective === "hospitalstaff") {
    redirect(home);
  }

  redirect("/unauthorized");
}
