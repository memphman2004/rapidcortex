"use client";

/**
 * Single RCS-monitored call card — state, escalation, units, closure gate.
 */

import { useState } from "react";
import { Clock, MapPin, Radio, Shield } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import { canManageRcsCall } from "@/lib/rcs/rcs-authz";
import { rcsEscalationColor, rcsStateToken, RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import type { RcsCall } from "@/lib/rcs/rcs-api";
import { RcsClosureModal } from "./RcsClosureModal";

export type RcsCallCardProps = {
  call: RcsCall;
  user: UserContext;
  onUpdated?: (call: RcsCall) => void;
};

function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function RcsCallCard({ call, user, onUpdated }: RcsCallCardProps) {
  const [closureOpen, setClosureOpen] = useState(false);
  const stateToken = rcsStateToken(call.state);
  const canManage = canManageRcsCall(user, call.agencyId);
  const isClosed = call.state === "CLOSED" || call.state === "OVERRIDE_CLOSED";
  const onSceneUnits = call.units.filter((u) => u.onScene).length;

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${stateToken.border}`,
        background: RCS_SURFACE.cardBg,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: RCS_SURFACE.heading }}>
            {call.callId}
          </div>
          <div style={{ fontSize: 11, color: RCS_SURFACE.subtleText, marginTop: 2 }}>
            {call.incidentId ? `Incident ${call.incidentId}` : "No CAD incident link"}
            {call.callerPhone ? ` · ${call.callerPhone}` : ""}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            color: stateToken.text,
            background: stateToken.bg,
            border: `1px solid ${stateToken.border}`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateToken.dot }} />
          {stateToken.label}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: RCS_SURFACE.bodyText }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} />
          {formatDuration(call.createdAt)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Shield size={12} color={rcsEscalationColor(call.escalationLevel)} />
          {call.escalationLevel}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Radio size={12} />
          Audio: {call.audioStatus}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} />
          Units: {call.units.length} ({onSceneUnits} on scene)
        </span>
      </div>

      {call.notes ? (
        <p style={{ margin: 0, fontSize: 11, color: RCS_SURFACE.subtleText }}>{call.notes}</p>
      ) : null}

      {canManage && !isClosed ? (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setClosureOpen(true)}
            style={{
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close call…
          </button>
        </div>
      ) : null}

      {closureOpen ? (
        <RcsClosureModal
          call={call}
          user={user}
          onClose={() => setClosureOpen(false)}
          onClosed={(updated) => {
            setClosureOpen(false);
            onUpdated?.(updated);
          }}
        />
      ) : null}
    </div>
  );
}
