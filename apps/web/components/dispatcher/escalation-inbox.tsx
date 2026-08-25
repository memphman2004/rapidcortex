"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EscalationRecord } from "rapid-cortex-shared";
import { EscalationStatusBadge } from "@/components/venue/escalation-status-badge";
import { isEscalationUiEnabled } from "@/lib/runtime-flags";

export function EscalationInbox({ agencyId }: { agencyId?: string }) {
  const qc = useQueryClient();
  const enabled = isEscalationUiEnabled() && Boolean(agencyId);
  const q = useQuery({
    queryKey: ["escalations-incoming", agencyId],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/escalations?direction=incoming", { credentials: "include" });
      // 404 = Escalation API not deployed yet; treat as empty rather than retry-spam.
      if (res.status === 404 || res.status === 501 || res.status === 503) return [];
      if (!res.ok) throw new Error(`Escalations HTTP ${res.status}`);
      const body = (await res.json()) as { items?: EscalationRecord[] };
      return body.items ?? [];
    },
    retry: (count, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404")) return false;
      return count < 2;
    },
    refetchInterval: (query) => (query.state.error ? false : 8_000),
  });
  const ack = useMutation({
    mutationFn: async (escalationId: string) => {
      const res = await fetch(`/api/escalations/${encodeURIComponent(escalationId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });
      if (!res.ok) throw new Error("Acknowledge failed");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["escalations-incoming"] }),
  });

  if (!enabled) return null;
  const pending = (q.data ?? []).filter((e) => e.status === "pending" || e.status === "active");
  if (pending.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-lg space-y-2">
        {pending.slice(0, 3).map((esc) => (
          <div
            key={esc.escalationId}
            className="rounded-xl border border-rose-500/40 bg-rose-950/90 p-3 shadow-lg backdrop-blur"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">
                  Incoming 911 escalation
                </p>
                <p className="mt-1 text-sm text-white">
                  {esc.sourceAgencyName}: {esc.incidentType}
                </p>
                <p className="text-xs text-white/60">{esc.incidentLocation.description}</p>
              </div>
              <EscalationStatusBadge status={esc.status} />
            </div>
            <button
              type="button"
              className="mt-2 min-h-[44px] w-full rounded-lg bg-rose-600 text-sm font-semibold text-white"
              onClick={() => ack.mutate(esc.escalationId)}
              disabled={ack.isPending}
            >
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
