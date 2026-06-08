import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { rcAdminHomeHrefForRole } from "@/lib/dashboards/rc-admin-role-nav";
import { marketingLoginPath } from "@/lib/marketing-links";

/** Canonical RC Admin home — role-aware redirect (rcitadmin → infrastructure). */
export default async function RcAdminIndexPage() {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(marketingLoginPath());
  }
  redirect(rcAdminHomeHrefForRole(user.role));
}
