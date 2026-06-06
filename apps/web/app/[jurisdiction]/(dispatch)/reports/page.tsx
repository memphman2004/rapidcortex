"use client";

import { isSupervisorOrAdmin } from "rapid-cortex-security";
import { useSession } from "@/components/auth/session-context";
import { ReportsDashboard } from "@/components/reports/reports-dashboard";
import { isReportsApiConfigured } from "@/lib/reports-api";
import { isReportsEnabled } from "@/lib/runtime-flags";

export default function ReportsPage() {
  const { user } = useSession();
  const enabled = isReportsEnabled() && isReportsApiConfigured();
  const supervisor = user ? isSupervisorOrAdmin(user.role) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          {supervisor
            ? "Generate operational reports across call volume, SLA compliance, QA scores, and more."
            : "View your dispatcher performance reports for the selected date range."}
        </p>
      </div>

      {enabled ? (
        <ReportsDashboard />
      ) : (
        <p className="text-sm text-slate-500">
          Enable <code className="text-slate-400">NEXT_PUBLIC_ENABLE_REPORTS=1</code> and connect the API to use
          reporting.
        </p>
      )}
    </div>
  );
}
