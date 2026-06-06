"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HospitalPortalContext, UserContext } from "rapid-cortex-shared";
import { getUserRoleDisplayLabel } from "rapid-cortex-shared/auth/role-display";

import { DashboardIntegrationHealth } from "@/components/dashboards/dashboard-integration-health";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { fetchHospitalPortalContext } from "@/lib/hospital-portal/api";
import { isHospitalPortalEnabled, isHospitalRoutingEnabled } from "@/lib/runtime-flags";
import { CurrentStatusPanel } from "./current-status-panel";
import { HospitalDashboard } from "./hospital-dashboard";
import { RecentUpdatesPanel } from "./recent-updates-panel";

/** Demo regional reference for facility network map (Tampa Bay — matches routing seed data). */
const REGIONAL_ROUTING_REFERENCE = { lat: 27.3364, lon: -82.5306 } as const;

type HospitalHomeVariant = "hospital-admin" | "hospital-staff";

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition hover:border-pink-500/40 hover:bg-slate-900/80"
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </Link>
  );
}

export function HospitalHomeDashboard({
  user,
  variant,
}: {
  user: UserContext;
  variant: HospitalHomeVariant;
}) {
  const [context, setContext] = useState<HospitalPortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const identity = getRoleDashboardIdentity(variant, user.role);
  const routingEnabled = isHospitalRoutingEnabled();
  const portalEnabled = isHospitalPortalEnabled();

  const load = useCallback(async () => {
    if (!portalEnabled) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchHospitalPortalContext();
      setContext(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load facility data");
    } finally {
      setLoading(false);
    }
  }, [portalEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!portalEnabled) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
        Hospital portal is not enabled in this environment. Set{" "}
        <code className="text-slate-200">NEXT_PUBLIC_ENABLE_HOSPITAL_PORTAL</code> or enable pilot
        test mode.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading facility overview…</p>;
  }

  if (error || !context) {
    return (
      <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-6 text-rose-200">
        <p>{error ?? "Unable to load facility data"}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm text-sky-400 underline">
          Retry
        </button>
      </div>
    );
  }

  const displayName = user.displayName ?? user.email;
  const capacity = context.capacity;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-white">{identity.identityTitle}</h1>
        <p className="max-w-3xl text-sm text-slate-400">{identity.identitySubtitle}</p>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-300">{context.hospital.name}</span>
          {" · "}
          Signed in as {displayName} ({getUserRoleDisplayLabel(user.role)})
        </p>
      </section>

      <DashboardIntegrationHealth prefix={variant} />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CurrentStatusPanel currentCapacity={capacity} />
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {variant === "hospital-admin" ? (
              <>
                <QuickAction
                  href="/hospital-admin/capacity"
                  title="Update capacity"
                  description="Publish ER, ICU, diversion, and staffing to dispatch routing."
                />
                <QuickAction
                  href="/hospital-admin/analytics"
                  title="Performance analytics"
                  description="Diversion trends and routing performance for your facility."
                />
                <QuickAction
                  href="/hospital-admin/users"
                  title="Staff access"
                  description="Manage hospital portal users and roles."
                />
              </>
            ) : (
              <>
                <QuickAction
                  href="/hospital-staff/capacity"
                  title="Update capacity"
                  description="Report bed availability and diversion status."
                />
                <QuickAction
                  href="/hospital-staff/history"
                  title="Recent updates"
                  description="Review your facility's capacity change history."
                />
              </>
            )}
          </div>
          <RecentUpdatesPanel key={capacity?.timestamp ?? "empty"} />
        </div>
      </section>

      {routingEnabled ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">
              Regional hospital network
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500">
              Peer facility capacity and transport recommendations for a reference incident in your
              region. Dispatchers use the live CAD workspace for incident-linked routing — this view
              is facility operations only.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <HospitalDashboard incidentLocation={REGIONAL_ROUTING_REFERENCE} />
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          Regional routing map is off. Enable{" "}
          <code className="text-slate-300">NEXT_PUBLIC_ENABLE_HOSPITAL_ROUTING</code> to preview the
          hospital network map on this page.
        </section>
      )}
    </div>
  );
}
