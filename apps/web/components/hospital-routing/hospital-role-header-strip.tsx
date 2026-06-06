"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { HospitalPortalContext } from "rapid-cortex-shared";

import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { getRoleDashboardIdentity } from "@/lib/dashboards/role-dashboard-design";
import { fetchHospitalPortalContext } from "@/lib/hospital-portal/api";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border px-3 py-1.5"
      style={{
        borderColor: "color-mix(in srgb, var(--role-accent) 35%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 45%, rgb(2 6 23))",
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--role-text-accent)" }}>
        {label}
      </p>
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function HospitalRoleHeaderStrip({ prefix }: { prefix: "hospital-admin" | "hospital-staff" }) {
  const id = getRoleDashboardIdentity(prefix, prefix === "hospital-admin" ? "hospitaladmin" : "hospitalstaff");
  const [context, setContext] = useState<HospitalPortalContext | null>(null);

  const load = useCallback(async () => {
    if (!isHospitalPortalEnabled()) return;
    try {
      setContext(await fetchHospitalPortalContext());
    } catch {
      setContext(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const capacity = context?.capacity;
  const er =
    capacity != null
      ? `${capacity.availability.erBeds.available}/${capacity.availability.erBeds.total}`
      : "—";
  const icu =
    capacity != null
      ? `${capacity.availability.icuBeds.available}/${capacity.availability.icuBeds.total}`
      : "—";
  const diversion = capacity?.diversion.isOnDiversion ? "On diversion" : "Open";
  const capacityHref = prefix === "hospital-admin" ? "/hospital-admin/capacity" : "/hospital-staff/capacity";

  const stripStyle = {
    borderColor: id.accentMuted,
    borderTop: `3px solid ${id.accent}`,
    background: `linear-gradient(90deg, color-mix(in srgb, ${id.dim} 75%, #020617) 0%, #020617 60%)`,
  } as const;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6" style={stripStyle}>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Facility</p>
        <p className="truncate text-sm font-semibold text-white">{context?.hospital.name ?? "Hospital portal"}</p>
      </div>
      <StatPill label="ER beds" value={er} />
      <StatPill label="ICU beds" value={icu} />
      <StatPill label="Diversion" value={diversion} />
      <Link
        href={capacityHref}
        className="ml-auto text-[11px] font-medium text-pink-200/90 underline-offset-2 hover:underline"
      >
        Update capacity →
      </Link>
    </div>
  );
}
