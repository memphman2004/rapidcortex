"use client";

import { DashboardHomeRenderer } from "@/components/dashboards/DashboardHomeRenderer";
import { useSession } from "@/components/auth/session-context";
import { NonEmergencyQueuePanel } from "@/components/triage/non-emergency-queue-panel";
import { StaffingForecastPanel } from "@/components/staffing/staffing-forecast-panel";
import { ShiftAlertBadge } from "@/components/staffing/shift-alert-badge";
import { useStaffingForecast } from "@/components/staffing/use-staffing-forecast";
import { isNonEmergencyTriageEnabled, isPredictiveStaffingEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();
  const staffingEnabled = isPredictiveStaffingEnabled();
  const { forecast } = useStaffingForecast(staffingEnabled && Boolean(user));

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName = user.email?.split("@")[0]?.replace(/[.+_-]/g, " ") ?? "there";

  return (
    <div className="space-y-6">
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
