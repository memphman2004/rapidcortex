"use client";

/**
 * apps/web/components/rcs/RcsMonitorPanel.tsx
 *
 * Response Continuity System (RCS) monitor — top-level client component rendered by
 * `apps/web/app/[jurisdiction]/(dispatch)/rcs/page.tsx`. Polls active calls via
 * `useRcsMonitor()`, shows the supervisor stats strip (supervisor+ only), and renders
 * an `RcsCallCard` per active call.
 */

import { useCallback, useState } from "react";
import { AlertCircle, RadioTower, ShieldCheck } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared/types";
import { canSupervisorOverride } from "@/lib/rcs/rcs-authz";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { useRcsMonitor } from "@/lib/rcs/use-rcs-monitor";
import type { RcsCall } from "@/lib/rcs/rcs-api";
import { RcsNavBadge, rcsNavBadgeStateFromCalls } from "./RcsNavBadge";
import { RcsSupervisorStrip } from "./RcsSupervisorStrip";
import { RcsCallCard } from "./RcsCallCard";

export type RcsMonitorPanelProps = {
  user: UserContext;
};

export function RcsMonitorPanel({ user }: RcsMonitorPanelProps) {
  const { calls, loading, error, live, refresh } = useRcsMonitor();
  const [overrides, setOverrides] = useState<Record<string, RcsCall>>({});
  const isSupervisor = canSupervisorOverride(user, user.agencyId);

  const applyOverride = useCallback((updated: RcsCall) => {
    setOverrides((prev) => ({ ...prev, [updated.callId]: updated }));
  }, []);

  const effectiveCalls = calls
    .filter(
      (c) =>
        !overrides[c.callId] ||
        (overrides[c.callId].state !== "CLOSED" && overrides[c.callId].state !== "OVERRIDE_CLOSED"),
    )
    .map((c) => overrides[c.callId] ?? c);
  const badgeState = rcsNavBadgeStateFromCalls(effectiveCalls);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "rgba(56, 189, 248, 0.1)",
            color: "#7dd3fc",
          }}
        >
          <ShieldCheck size={18} />
        </span>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: RCS_SURFACE.heading, margin: 0 }}>
            Response Continuity Monitor
          </h1>
          <p style={{ fontSize: 12, color: RCS_SURFACE.subtleText, margin: 0 }}>
            Audio, unit position, and supervisor continuity tracking for active calls.
          </p>
        </div>
        <RcsNavBadge count={badgeState.count} pulse={badgeState.pulse} />
        <span
          title={live ? "Live updates connected" : "Polling — live updates unavailable"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            color: live ? "#86efac" : RCS_SURFACE.subtleText,
          }}
        >
          <RadioTower size={12} />
          {live ? "Live" : "Polling"}
        </span>
      </div>

      {isSupervisor ? <RcsSupervisorStrip calls={effectiveCalls} /> : null}

      {error ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderRadius: 8,
            border: "1px solid rgba(248, 113, 113, 0.35)",
            background: "rgba(239, 68, 68, 0.08)",
            color: "#fca5a5",
            fontSize: 12,
          }}
        >
          <AlertCircle size={14} />
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            style={{ marginLeft: "auto", color: "#fca5a5", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && effectiveCalls.length === 0 ? (
        <div style={{ fontSize: 12, color: RCS_SURFACE.subtleText, padding: 24, textAlign: "center" }}>
          Loading active calls…
        </div>
      ) : effectiveCalls.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "40px 20px",
            borderRadius: 10,
            border: `1px dashed ${RCS_SURFACE.border}`,
            color: RCS_SURFACE.subtleText,
          }}
        >
          <ShieldCheck size={28} />
          <span style={{ fontSize: 13, fontWeight: 600, color: RCS_SURFACE.subtleText }}>
            No active continuity sessions
          </span>
          <span style={{ fontSize: 11 }}>RCS calls will appear here as soon as monitoring starts.</span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {effectiveCalls.map((call) => (
            <RcsCallCard key={call.callId} call={call} user={user} onUpdated={applyOverride} />
          ))}
        </div>
      )}
    </div>
  );
}
