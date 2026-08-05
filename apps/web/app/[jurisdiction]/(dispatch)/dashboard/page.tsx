"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { PsapConsoleHome } from "@/components/psap/psap-console-home";
import { dashboardDisplayName } from "@/lib/dashboards/dashboard-display-name";
import { dispatchDashboardHref } from "@/lib/dispatch-workspace-links";
import { useOptionalJurisdictionSlug } from "@/lib/jurisdiction-context";
import { defaultJurisdictionSlug } from "@/lib/marketing-links";
import { formatJurisdictionAgencyName } from "@/lib/psap/format-agency-display-name";

/**
 * PSAP ops overview console (refreshed home).
 * Live CAD workspace lives at `/{jurisdiction}/dispatcher` — deep links with
 * `?incident=` / `?queue=` redirect there.
 */
function DashboardOverview() {
  const { user, isLoading } = useSession();
  const searchParams = useSearchParams();
  const jurisdiction =
    useOptionalJurisdictionSlug() ?? defaultJurisdictionSlug();

  const incidentId = searchParams.get("incident")?.trim() || undefined;
  const queueRaw = searchParams.get("queue")?.trim();
  const queue =
    queueRaw === "non_emergency" || queueRaw === "all" ? queueRaw : undefined;

  useEffect(() => {
    if (!incidentId && !queue) return;
    window.location.replace(
      dispatchDashboardHref(jurisdiction, {
        incidentId,
        queue: queue === "all" ? undefined : queue,
      }),
    );
  }, [incidentId, queue, jurisdiction]);

  if (incidentId || queue) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Opening live workspace…
      </div>
    );
  }

  if (isLoading) return null;
  if (!user) return null;

  const displayName =
    user.displayName?.trim() || dashboardDisplayName(user);
  const agencyName = formatJurisdictionAgencyName(jurisdiction, user.agencyId);

  return (
    <PsapConsoleHome
      agencyId={user.agencyId}
      jurisdiction={jurisdiction}
      agencyName={agencyName}
      displayName={displayName}
      userEmail={user.email}
      userRole={user.role}
      userId={user.userId}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading dashboard…
        </div>
      }
    >
      <DashboardOverview />
    </Suspense>
  );
}
