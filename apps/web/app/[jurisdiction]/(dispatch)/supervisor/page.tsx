"use client";

import { useRouter } from "next/navigation";
import { DashboardHomeRenderer } from "@/components/dashboards/DashboardHomeRenderer";
import { useSession } from "@/components/auth/session-context";
import { CreateIncidentButton } from "@/components/dispatcher/create-incident-slide-over";
import { isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { NonEmergencyQueuePanel } from "@/components/triage/non-emergency-queue-panel";
import { StaffingForecastPanel } from "@/components/staffing/staffing-forecast-panel";
import { ShiftAlertBadge } from "@/components/staffing/shift-alert-badge";
import { useStaffingForecast } from "@/components/staffing/use-staffing-forecast";
import { isNonEmergencyTriageEnabled, isPredictiveStaffingEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();
  const router = useRouter();
  const to = useJurisdictionLink();
  const staffingEnabled = isPredictiveStaffingEnabled();
  const { forecast } = useStaffingForecast(staffingEnabled && Boolean(user));

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName = user.email?.split("@")[0]?.replace(/[.+_-]/g, " ") ?? "there";

  return (
    <div className="space-y-6">
      {isApiConfigured() ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Create a manual incident and open it in the dispatcher workspace.
          </p>
          <CreateIncidentButton
            userRole={user.role}
            mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
            onCreated={(result) => {
              router.push(`${to("/dashboard")}?incident=${encodeURIComponent(result.incidentId)}`);
            }}
          />
        </div>
      ) : null}
      {staffingEnabled && forecast ? (
        <ShiftAlertBadge shift={forecast.weekSummary.peakRiskShift} />
      ) : null}
      <StaffingForecastPanel enabled={staffingEnabled} />
      <NonEmergencyQueuePanel enabled={isNonEmergencyTriageEnabled()} />
      <DashboardHomeRenderer
        role={user.role}
        agencyId={user.agencyId}
        displayName={displayName}
      />
    </div>
  );
}
