import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { TransitCamerasPageClient } from "@/components/transit/transit-cameras-page-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";

const TRANSIT_CONSOLE_ROLES = new Set([
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
  "TRANSIT_OPERATOR",
]);

export default async function TransitCamerasPage({
  params,
}: {
  params: Promise<{ transitCode: string }>;
}) {
  const { transitCode } = await params;
  const from = `/transit/${encodeURIComponent(transitCode)}/cameras`;

  if (!isVerticalEnabled("transit")) {
    redirect("/unauthorized");
  }
  if (!isTransitCamerasUiEnabled()) {
    redirect(`/transit/${encodeURIComponent(transitCode)}`);
  }

  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`/login?from=${encodeURIComponent(from)}`);
  }

  const roleToken = user.role.trim().toUpperCase();
  const roleVertical = verticalFromRole(user.role);
  if (roleVertical !== "transit" && !TRANSIT_CONSOLE_ROLES.has(roleToken)) {
    redirect(dashboardRouteFromRole(user.role, user.agencyId));
  }
  if (!user.agencyId) {
    redirect(`/transit/${encodeURIComponent(transitCode)}`);
  }

  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading cameras…</p>}>
      <TransitCamerasPageClient
        agencyId={user.agencyId}
        transitCode={transitCode}
        transitName={transitCode.toUpperCase()}
        userEmail={user.email ?? ""}
        userRole={user.role}
        userId={user.userId}
      />
    </Suspense>
  );
}
