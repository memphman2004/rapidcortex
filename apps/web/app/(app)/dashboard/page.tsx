import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  dashboardHubRedirectForInternalOperator,
  resolveDashboardHubRedirectHref,
  shouldRedirectAwayFromDashboardHub,
} from "@/lib/auth/dashboard-hub-redirect";
import { COOKIE_PASSWORD_ROTATION_NAV_BYPASS } from "@/lib/auth/cookies";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { getAppDashboardSession } from "../_lib/dashboard-session";

type SearchParams = Promise<{ from?: string; next?: string }>;

/** Role-aware hub — sends every signed-in user to their canonical dashboard home. */
export default async function DashboardRoutePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getAppDashboardSession();
  const sp = await searchParams;
  const fromParam = sp.from ?? sp.next ?? null;

  if (shouldRedirectAwayFromDashboardHub(session.user)) {
    redirect(dashboardHubRedirectForInternalOperator(session.user));
  }

  const jar = await cookies();
  const passwordRotationBypass =
    jar.get(COOKIE_PASSWORD_ROTATION_NAV_BYPASS)?.value === "1";

  redirect(
    resolveDashboardHubRedirectHref(session.user, {
      passwordRotationBypass,
      jurisdictionSlug: defaultJurisdictionSlug(),
      fromParam,
    }),
  );
}
