"use client";

import { useCallback, useEffect, useState } from "react";
import type { HospitalPortalContext, UserContext } from "rapid-cortex-shared";
import { getUserRoleDisplayLabel } from "rapid-cortex-shared/auth/role-display";

import { CapacityUpdateForm } from "@/components/hospital-routing/capacity-update-form";
import { CurrentStatusPanel } from "@/components/hospital-routing/current-status-panel";
import { RecentUpdatesPanel } from "@/components/hospital-routing/recent-updates-panel";
import { fetchHospitalPortalContext } from "@/lib/hospital-portal/api";
import { DashboardIntegrationHealth } from "@/components/dashboards/dashboard-integration-health";

export function HospitalCapacityWorkspace({
  user,
  showRecentUpdates = true,
}: {
  user: UserContext;
  showRecentUpdates?: boolean;
}) {
  const [context, setContext] = useState<HospitalPortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchHospitalPortalContext();
      setContext(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading facility data…</p>;
  }

  if (error || !context) {
    return (
      <MotionSafeRetryBlock error={error} onRetry={() => void load()} />
    );
  }

  const displayName = user.displayName ?? user.email;

  const healthPrefix = user.role === "hospitaladmin" ? "hospital-admin" : "hospital-staff";

  return (
    <div className="space-y-6">
      <DashboardIntegrationHealth prefix={healthPrefix} />
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h2 className="text-lg font-semibold text-white">{context.hospital.name}</h2>
        <p className="text-sm text-slate-400">
          Signed in as {displayName} · {getUserRoleDisplayLabel(user.role)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CapacityUpdateForm context={context} onUpdated={() => void load()} />
        </div>
        <div className="space-y-6">
          <CurrentStatusPanel currentCapacity={context.capacity} />
          {showRecentUpdates ? (
            <RecentUpdatesPanel key={context.capacity?.timestamp ?? "empty"} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MotionSafeRetryBlock({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-6 text-rose-200">
      <p>{error ?? "Unable to load facility data"}</p>
      <button type="button" onClick={onRetry} className="mt-3 text-sm text-sky-400 underline">
        Retry
      </button>
    </div>
  );
}
