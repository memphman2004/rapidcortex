"use client";

import type { UserContext } from "rapid-cortex-shared";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { HospitalRoleHeaderStrip } from "@/components/hospital-routing/hospital-role-header-strip";
import {
  getRoleDashboardIdentity,
} from "@/lib/dashboards/role-dashboard-design";
import { RcAdminHeaderStats } from "./rc-admin-live-dashboard";

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

export function RoleDashboardHeaderStrip({
  prefix,
  user,
}: {
  prefix: DashboardPrefix;
  user: UserContext;
}) {
  const id = getRoleDashboardIdentity(prefix, user.role);

  const stripStyle = {
    borderColor: id.accentMuted,
    borderTop: `3px solid ${id.accent}`,
    background: `linear-gradient(90deg, color-mix(in srgb, ${id.dim} 75%, #020617) 0%, #020617 60%)`,
  } as const;

  if (prefix === "dispatcher") {
    return (
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6"
        style={stripStyle}
      >
        <div className="flex items-center gap-2">
          <span
            className="relative flex h-2.5 w-2.5"
            aria-hidden
            style={{ color: id.accent }}
          >
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: id.accent }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: id.accent }}
            />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
            Live incidents
          </span>
        </div>
        <StatPill label="Open queue" value="12" />
        <StatPill label="Active CAD" value="3" />
        <StatPill label="System" value="Nominal" />
        <span
          className="ml-auto hidden text-[11px] text-slate-400 sm:inline"
          style={{ color: id.accent }}
        >
          Mission link · encrypted
        </span>
      </div>
    );
  }

  if (prefix === "supervisor") {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6" style={stripStyle}>
        <StatPill label="Dispatchers on shift" value="8" />
        <StatPill label="Open incidents" value="12" />
        <StatPill label="Coverage" value="94%" />
        <p className="ml-auto hidden max-w-md text-[11px] text-slate-400 md:block">
          Shift summary · analytical view — calmer pacing than mission control.
        </p>
      </div>
    );
  }

  if (prefix === "agency-admin") {
    return (
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6"
        style={stripStyle}
      >
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Agency</p>
          <p className="text-sm font-semibold text-white">{user.agencyId}</p>
        </div>
        <StatPill label="Directory sync" value="OK" />
        <StatPill label="CAD bridge" value="Healthy" />
        <StatPill label="Billing" value="Current" />
      </div>
    );
  }

  if (prefix === "rc-admin") {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6" style={stripStyle}>
        <RcAdminHeaderStats />
      </div>
    );
  }

  if (prefix === "qa") {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6" style={stripStyle}>
        <StatPill label="Report queue" value="18" />
        <StatPill label="Exports ready" value="3" />
        <StatPill label="Data freshness" value="< 15m" />
      </div>
    );
  }

  if (prefix === "it-security") {
    return (
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6"
        style={stripStyle}
      >
        <StatPill label="MFA posture" value="Strong" />
        <StatPill label="Failed logins (24h)" value="7" />
        <StatPill label="Policy drift" value="None" />
      </div>
    );
  }

  if (prefix === "hospital-admin" || prefix === "hospital-staff") {
    return <HospitalRoleHeaderStrip prefix={prefix} />;
  }

  /* executive */
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6" style={stripStyle}>
      <StatPill label="Response SLA" value="Met" />
      <StatPill label="QA pass rate" value="97%" />
      <StatPill label="Training hours" value="1.2k" />
    </div>
  );
}
