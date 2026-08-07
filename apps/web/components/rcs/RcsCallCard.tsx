"use client";

/**
 * Single RCS-monitored call card — state, escalation, units, closure gate,
 * AI summary, soft handoff, and arrival confirmation.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronUp, Clock, HandHelping, Radio, Shield } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import {
  canAcceptSoftHandoff,
  canManageRcsCall,
  canRequestSoftHandoff,
} from "@/lib/rcs/rcs-authz";
import { rcsEscalationColor, rcsStateToken, RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import {
  rcsAcceptSoftHandoff,
  rcsClearSoftHandoff,
  rcsRequestSoftHandoff,
  rcsTriggerCallSummary,
  type RcsCall,
} from "@/lib/rcs/rcs-api";
import { formatElapsed } from "./rcs-ui-utils";
import { RcsAiSummaryStrip } from "./RcsAiSummaryStrip";
import { RcsArrivalConfirmationBadge } from "./RcsArrivalConfirmationBadge";
import { RcsEscalationBeacon } from "./RcsEscalationBeacon";
import { RcsSoftHandoffBanner } from "./RcsSoftHandoffBanner";
import { RcsClosureModal } from "./RcsClosureModal";

export type RcsCallCardProps = {
  call: RcsCall;
  user: UserContext;
  onUpdated?: (call: RcsCall) => void;
  /** Start expanded (default false for compact grid). */
  defaultExpanded?: boolean;
};

export function RcsCallCard({ call, user, onUpdated, defaultExpanded = false }: RcsCallCardProps) {
  const [closureOpen, setClosureOpen] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const stateToken = rcsStateToken(call.state);
  const canManage = canManageRcsCall(user, call.agencyId);
  const canRequest = canRequestSoftHandoff(user, call.agencyId, call.assignedDispatcherId);
  const canAccept =
    Boolean(call.softHandoff) &&
    canAcceptSoftHandoff(user, call.agencyId, call.softHandoff?.requestedByUserId ?? "");
  const isClosed = call.state === "CLOSED" || call.state === "OVERRIDE_CLOSED";
  const displayName =
    user.displayName?.trim() || user.email?.trim() || user.userId;

  async function refreshLocal(patch: Partial<RcsCall>) {
    onUpdated?.({ ...call, ...patch, updatedAt: new Date().toISOString() });
  }

  async function requestHandoff() {
    setBusy(true);
    setActionError(null);
    try {
      const handoff = await rcsRequestSoftHandoff(call.callId);
      await refreshLocal({ softHandoff: handoff });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Handoff request failed");
    } finally {
      setBusy(false);
    }
  }

  async function acceptHandoff() {
    setBusy(true);
    setActionError(null);
    try {
      const handoff = await rcsAcceptSoftHandoff(call.callId, {
        acceptorDisplayName: displayName,
      });
      await refreshLocal({ softHandoff: handoff });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Accept failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearHandoff() {
    setBusy(true);
    setActionError(null);
    try {
      await rcsClearSoftHandoff(call.callId);
      await refreshLocal({ softHandoff: undefined });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSummary() {
    setBusy(true);
    setActionError(null);
    try {
      const summary = await rcsTriggerCallSummary(call.callId);
      await refreshLocal({ aiSummary: summary });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setBusy(false);
    }
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <RcsEscalationBeacon level={call.escalationLevel} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: RCS_SURFACE.heading }}>
              {call.callId}
            </div>
            <div style={{ fontSize: 11, color: RCS_SURFACE.subtleText, marginTop: 2 }}>
              {call.incidentId ? `Incident ${call.incidentId}` : "No CAD incident link"}
              {call.callerPhone ? ` · ${call.callerPhone}` : ""}
            </div>
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
          {formatElapsed(call.createdAt)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Shield size={12} color={rcsEscalationColor(call.escalationLevel)} />
          {call.escalationLevel}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Radio size={12} />
          Audio: {call.audioStatus}
        </span>
        <RcsArrivalConfirmationBadge units={call.units} compact />
      </div>

      <RcsAiSummaryStrip summary={call.aiSummary} compact />

      {call.softHandoff && call.softHandoff.state !== "CLEARED" ? (
        <RcsSoftHandoffBanner
          handoff={call.softHandoff}
          canAccept={canAccept && !isClosed}
          canClear={(canRequest || canAccept) && !isClosed}
          onAccept={() => void acceptHandoff()}
          onClear={() => void clearHandoff()}
        />
      ) : null}

      {call.notes ? (
        <p style={{ margin: 0, fontSize: 11, color: RCS_SURFACE.subtleText }}>{call.notes}</p>
      ) : null}

      {actionError ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--rc-red-light)" }}>{actionError}</p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, alignItems: "center" }}>
        {canManage && !isClosed ? (
          <button
            type="button"
            onClick={() => setClosureOpen(true)}
            style={btnStyle}
          >
            Close call…
          </button>
        ) : null}
        {canRequest && !isClosed && (!call.softHandoff || call.softHandoff.state === "CLEARED") ? (
          <button type="button" disabled={busy} onClick={() => void requestHandoff()} style={btnStyle}>
            <HandHelping size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
            Request handoff
          </button>
        ) : null}
        {canManage && !isClosed ? (
          <button type="button" disabled={busy} onClick={() => void refreshSummary()} style={btnStyle}>
            Refresh AI
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ ...btnStyle, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {expanded ? (
        <div
          style={{
            fontSize: 11,
            color: RCS_SURFACE.subtleText,
            borderTop: `1px solid ${RCS_SURFACE.border}`,
            paddingTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div>
            Dispatcher:{" "}
            {formatDispatcherLabel(call.assignedDispatcherDisplayName, call.assignedDispatcherId)}
          </div>
          <div>Units: {call.units.length}</div>
          {call.units.map((u) => (
            <div key={u.unitId}>
              {u.callSign ?? u.unitId}
              {u.onScene ? " · on scene" : u.distanceMeters != null ? ` · ${Math.round(u.distanceMeters)}m` : ""}
            </div>
          ))}
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

/** Prefer email / human label; avoid showing Cognito UUID usernames. */
function formatDispatcherLabel(
  displayName: string | null | undefined,
  dispatcherId: string | null | undefined,
): string {
  const label = displayName?.trim();
  if (label && !isCognitoUuid(label)) return label;
  if (dispatcherId?.trim() && !isCognitoUuid(dispatcherId)) return dispatcherId.trim();
  return label || dispatcherId?.trim() || "—";
}

function isCognitoUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

const btnStyle: CSSProperties = {
  borderRadius: 6,
  border: "1px solid var(--rc-border)",
  background: "var(--rc-surface)",
  color: "var(--rc-text-primary)",
  fontSize: 11,
  fontWeight: 600,
  padding: "6px 10px",
  cursor: "pointer",
};
