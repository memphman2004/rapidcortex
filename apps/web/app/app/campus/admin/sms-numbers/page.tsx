import { redirect } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { extractCampusCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { smsRoutingPermissions } from "@/lib/sms-routing/access";

export const metadata = {
  title: "SMS Numbers (Campus Admin)",
  robots: { index: false, follow: false },
};

/** Canonical SMS UI lives in the campus dashboard shell. */
export default async function CampusAdminSmsNumbersPage() {
  const user = await getDashboardSessionUser();
  if (!user) redirect("/login");
  if (isRcInternalOperator(user.role)) redirect("/rc-admin/qr-nfc");

  const perms = smsRoutingPermissions(user, user.agencyId);
  if (!perms.canView) redirect("/unauthorized");

  const campusCode = extractCampusCode(user.agencyId);
  if (!campusCode) redirect("/unauthorized");
  redirect(`/app/campus/${encodeURIComponent(campusCode)}/sms-numbers`);
}
