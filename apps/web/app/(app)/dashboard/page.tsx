import { redirect } from "next/navigation";
import { resolvePostAuthenticationHomeHref } from "@/lib/auth/post-login-redirect";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { getAppDashboardSession } from "../_lib/dashboard-session";

/** Role-aware hub — sends every signed-in user to their canonical dashboard home. */
export default async function DashboardRoutePage() {
  const session = await getAppDashboardSession();
  redirect(
    resolvePostAuthenticationHomeHref(session.user, defaultJurisdictionSlug()),
  );
}
