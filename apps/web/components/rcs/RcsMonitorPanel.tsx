"use client";

/**
 * apps/web/components/rcs/RcsMonitorPanel.tsx
 *
 * Response Continuity System (RCS) monitor — top-level client component rendered by
 * `apps/web/app/[jurisdiction]/(dispatch)/rcs/page.tsx`. Polls active calls via
 * `useRcsMonitor()`, shows the supervisor stats strip (supervisor+ only), and renders
 * an `RcsCallCard` per active call.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, AlertCircle, RadioTower, Settings2, ShieldCheck } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared/types";
import { canSupervisorOverride } from "@/lib/rcs/rcs-authz";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { useRcsMonitor } from "@/lib/rcs/use-rcs-monitor";
import type { RcsCall } from "@/lib/rcs/rcs-api";
import { escalationSortRank } from "./rcs-ui-utils";
import { RcsNavBadge, rcsNavBadgeStateFromCalls } from "./RcsNavBadge";
import { RcsSupervisorStrip } from "./RcsSupervisorStrip";
import { RcsCallCard } from "./RcsCallCard";
import { RcsSoftHandoffBanner } from "./RcsSoftHandoffBanner";
import { RcsFloorHealthPanel } from "./RcsFloorHealthPanel";
import { RcsEscalationRulesModal } from "./RcsEscalationRulesModal";

export type RcsMonitorPanelProps = {
  user: UserContext;
};

type Toast = { id: number; message: string };

export function RcsMonitorPanel({ user }: RcsMonitorPanelProps) {
  const { calls, loading, error, live, refresh } = useRcsMonitor();
  const [overrides, setOverrides] = useState<Record<string, RcsCall>>({});
  const [floorOpen, setFloorOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isSupervisor = canSupervisorOverride(user, user.agencyId);
  const prevSnapshot = useState(() => new Map<string, string>())[0];

  const applyOverride = useCallback((updated: RcsCall) => {
    setOverrides((prev) => ({ ...prev, [updated.callId]: updated }));
  }, []);

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((t) => [...t.slice(-4), { id, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  const effectiveCalls = useMemo(() => {
    const list = calls
      .filter(
        (c) =>
          !overrides[c.callId] ||
          (overrides[c.callId].state !== "CLOSED" && overrides[c.callId].state !== "OVERRIDE_CLOSED"),
      )
      .map((c) => overrides[c.callId] ?? c);
    return [...list].sort(
      (a, b) => escalationSortRank(a.escalationLevel) - escalationSortRank(b.escalationLevel),
    );
  }, [calls, overrides]);

  const badgeState = rcsNavBadgeStateFromCalls(effectiveCalls);

  const pendingHandoffs = effectiveCalls.filter(
    (c) => c.softHandoff?.state === "REQUESTED" || c.softHandoff?.state === "ACTIVE",
  );

  // Simple toast on escalation / arrival / handoff transitions (poll + WS refresh).
  useEffect(() => {
    for (const call of effectiveCalls) {
      const key = call.callId;
      const sig = [
        call.escalationLevel,
        call.units.filter((u) => u.onScene).map((u) => u.unitId).join(","),
        call.softHandoff?.state ?? "",
        call.softHandoff?.acceptedAt ?? "",
      ].join("|");
      const prev = prevSnapshot.get(key);
      if (prev && prev !== sig) {
        const [prevLevel, prevUnits, prevHandoff] = prev.split("|");
        if (prevLevel !== call.escalationLevel) {
          pushToast(`${call.callId}: escalation → ${call.escalationLevel}`);
        }
        const nowUnits = call.units.filter((u) => u.onScene).map((u) => u.unitId).join(",");
        if (prevUnits !== nowUnits && nowUnits.length > prevUnits.length) {
          pushToast(`${call.callId}: unit arrival confirmed`);
        }
        if (prevHandoff !== (call.softHandoff?.state ?? "") && call.softHandoff) {
          pushToast(
            `${call.callId}: handoff ${call.softHandoff.state.toLowerCase()}`,
          );
        }
      }
      prevSnapshot.set(key, sig);
    }
  }, [effectiveCalls, prevSnapshot, pushToast]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
        {isSupervisor ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
            <button type="button" onClick={() => setFloorOpen(true)} style={headerBtn}>
              <Activity size={12} /> Floor Health
            </button>
            <button type="button" onClick={() => setRulesOpen(true)} style={headerBtn}>
              <Settings2 size={12} /> Escalation Rules
            </button>
          </span>
        ) : null}
      </div>

      {isSupervisor ? <RcsSupervisorStrip calls={effectiveCalls} /> : null}

      {pendingHandoffs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pendingHandoffs.map((c) =>
            c.softHandoff ? (
              <RcsSoftHandoffBanner key={`handoff-${c.callId}`} handoff={c.softHandoff} callId={c.callId} />
            ) : null,
          )}
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                fontSize: 11,
                color: "#e2e8f0",
                background: "rgba(56, 189, 248, 0.12)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      ) : null}

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

      <RcsFloorHealthPanel open={floorOpen} onClose={() => setFloorOpen(false)} />
      <RcsEscalationRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

const headerBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 11,
  fontWeight: 600,
  padding: "6px 10px",
  cursor: "pointer",
};
