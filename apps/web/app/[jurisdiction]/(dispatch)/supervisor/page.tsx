"use client";

import { RoleDashboardSmokePanel } from "@/components/dispatch/role-dashboard-smoke-panel";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "./_components/supervisor-access";

export default function SupervisorHomePage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="p-6">
      <RoleDashboardSmokePanel
        title="Supervisor"
        pathLabel="/[jurisdiction]/supervisor"
      />
      <p className="text-sm text-slate-400">
        Deeper tools live under <span className="font-mono">/supervisor/qa</span>,{" "}
        <span className="font-mono">/supervisor/performance</span>, etc.
      </p>
    </div>
  );
}
