"use client";

import { useSession } from "@/components/auth/session-context";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { isReportsApiConfigured } from "@/lib/reports-api";
import { isReportsEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../_components/supervisor-access";

export default function SupervisorReportsPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  const enabled = isReportsEnabled() && isReportsApiConfigured();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Generate operational reports across call volume, SLA compliance, QA scores, and more.
        </p>
      </div>

      {enabled ? (
        <ReportsDashboard />
      ) : (
        <p className="text-sm text-slate-500">
          Reporting isn’t enabled yet. Contact Rapid Cortex support.
        </p>
      )}
    </div>
  );
}
