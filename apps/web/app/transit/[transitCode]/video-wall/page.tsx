import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dashboardRouteFromRole, verticalFromRole } from "rapid-cortex-shared";
import { TransitVideoWallPageClient } from "@/components/transit/transit-video-wall-page-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { isRcVideoEnabled } from "@/lib/runtime-flags";
import { isVideoWallRoleBlocked } from "@/lib/video/video-wall-access";

const TRANSIT_CONSOLE_ROLES = new Set([
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
  "TRANSIT_OPERATOR",
]);

export default async function TransitVideoWallPage({
  params,
}: {
  params: Promise<{ transitCode: string }>;
}) {
  const { transitCode } = await params;
  const from = `/transit/${encodeURIComponent(transitCode)}/video-wall`;

  if (!isVerticalEnabled("transit")) {
    redirect("/unauthorized");
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

  if (!isRcVideoEnabled() || isVideoWallRoleBlocked(user.role) || !user.agencyId) {
    redirect(`/transit/${encodeURIComponent(transitCode)}/cameras`);
  }

  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading video wall…</p>}>
      <TransitVideoWallPageClient
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
