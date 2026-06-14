"use client";

import { DashboardHomeRenderer } from "@/components/dashboards/DashboardHomeRenderer";
import { useSession } from "@/components/auth/session-context";
import { NonEmergencyQueuePanel } from "@/components/triage/non-emergency-queue-panel";
import { isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!user) return null;

  const displayName = user.email?.split("@")[0]?.replace(/[.+_-]/g, " ") ?? "there";

  return (
    <div className="space-y-6">
      <NonEmergencyQueuePanel enabled={isNonEmergencyTriageEnabled()} />
      <DashboardHomeRenderer
        role={user.role}
        agencyId={user.agencyId}
        displayName={displayName}
      />
    </div>
  );
}
