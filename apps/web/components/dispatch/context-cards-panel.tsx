"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ContextCard } from "rapid-cortex-shared";
import { isContextCardsEnabled } from "@/lib/runtime-flags";

async function fetchContextCard(incidentId: string): Promise<ContextCard | null> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/context-card`, {
    credentials: "include",
  });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load context card");
  return (await res.json()) as ContextCard;
}

export function ContextCardsPanel({ incidentId }: { incidentId: string | null }) {
  const [callerOpen, setCallerOpen] = useState(false);
  const enabled = isContextCardsEnabled();
  const q = useQuery({
    queryKey: ["context-card", incidentId],
    queryFn: () => fetchContextCard(incidentId!),
    enabled: enabled && Boolean(incidentId),
    staleTime: 30_000,
  });

  if (!enabled) return null;
  if (!incidentId) {
    return (
      <div className="border-b px-3 py-2 text-xs" style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-muted)" }}>
        Select an incident for location context.
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div className="border-b px-3 py-2 text-xs" style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-muted)" }}>
        Loading context…
      </div>
    );
  }

  const card = q.data;
  if (!card) {
    return (
      <div className="border-b px-3 py-2 text-xs" style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-muted)" }}>
        No context available for this incident.
      </div>
    );
  }

  const loc = card.location;
  const badgeColor = loc.officerSafetyFlag
    ? "var(--rc-red)"
    : loc.priorCalls12Months > 5
      ? "var(--rc-amber)"
      : "var(--rc-text-muted)";
  const sourceLabel =
    loc.dataSource === "cad_and_vault"
      ? "CAD + Vault"
      : loc.dataSource === "vault_only"
        ? "Vault"
        : "CAD only";

  return (
    <div className="border-b px-3 py-2 text-xs" style={{ borderColor: "var(--rc-border)", color: "var(--rc-text)" }}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold" title={loc.address}>
            {loc.address}
          </div>
          <div className="mt-0.5" style={{ color: badgeColor }}>
            {loc.priorCalls12Months} prior calls (12 mo)
            {loc.priorCallsAllTime > loc.priorCalls12Months
              ? ` · ${loc.priorCallsAllTime} all-time`
              : ""}
          </div>
        </div>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
          style={{ background: "var(--rc-workstation-bg)", color: "var(--rc-text-muted)" }}
        >
          {sourceLabel}
        </span>
      </div>

      {loc.officerSafetyFlag ? (
        <div
          className="mb-2 rounded px-2 py-1.5 font-medium"
          style={{ background: "rgba(239,68,68,0.15)", color: "var(--rc-red)" }}
          role="alert"
        >
          Officer safety flag
          {loc.officerSafetyNote ? `: ${loc.officerSafetyNote}` : ""}
        </div>
      ) : null}

      {Object.keys(loc.callsByType).length > 0 ? (
        <ul className="mb-2 space-y-0.5" style={{ color: "var(--rc-text-muted)" }}>
          {Object.entries(loc.callsByType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, n]) => (
              <li key={type} className="flex justify-between gap-2">
                <span className="truncate capitalize">{type.replace(/_/g, " ")}</span>
                <span>{n}</span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mb-2" style={{ color: "var(--rc-text-muted)" }}>
          No prior calls at this location.
        </p>
      )}

      {loc.activeRelatedIncidents > 0 ? (
        <p className="mb-2" style={{ color: "var(--rc-amber)" }}>
          {loc.activeRelatedIncidents} open incident{loc.activeRelatedIncidents === 1 ? "" : "s"} at this address
        </p>
      ) : null}

      {card.caller ? (
        <div>
          <button
            type="button"
            className="text-left font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--rc-blue)" }}
            onClick={() => setCallerOpen((v) => !v)}
          >
            Caller history {callerOpen ? "▾" : "▸"}
          </button>
          {callerOpen ? (
            <div className="mt-1 space-y-0.5" style={{ color: "var(--rc-text-muted)" }}>
              <div>{card.caller.phone}</div>
              <div>{card.caller.priorCallCount} prior calls from this number</div>
              {card.caller.lastCallDate ? (
                <div>
                  Last: {card.caller.lastCallDate.slice(0, 10)}
                  {card.caller.lastCallType ? ` · ${card.caller.lastCallType}` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
