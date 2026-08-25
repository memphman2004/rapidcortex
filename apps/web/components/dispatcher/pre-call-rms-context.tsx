"use client";

import { useQuery } from "@tanstack/react-query";
import { isRmsUiEnabled } from "@/lib/runtime-flags";

type ContextPayload = {
  context: {
    addressHistory?: {
      address: string;
      priorIncidentCount: number;
      lastIncidentDate?: string;
      lastIncidentType?: string;
      hasActiveProtectiveOrder: boolean;
      hasHazardFlag: boolean;
      hazardDescription?: string;
    };
    callerHistory?: {
      phone: string;
      priorCallCount: number;
      lastCallDate?: string;
      isKnownOffender: boolean;
      hasActiveWarrant: boolean;
    };
    cached?: boolean;
    dataSource?: string;
  } | null;
};

/**
 * Live-call RMS context strip. Silent when RMS is unset or the query fails.
 */
export function PreCallRmsContext({
  address,
  phone,
}: {
  address?: string | null;
  phone?: string | null;
}) {
  const enabled = isRmsUiEnabled() && Boolean(address || phone);

  const query = useQuery({
    queryKey: ["rms-context", address ?? "", phone ?? ""],
    enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<ContextPayload["context"]> => {
      const sp = new URLSearchParams();
      if (address) sp.set("address", address);
      if (phone) sp.set("phone", phone);
      const res = await fetch(`/api/rms/context?${sp.toString()}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as ContextPayload;
      return data.context ?? null;
    },
  });

  const ctx = query.data;
  if (!enabled || query.isError || !ctx) return null;

  const ah = ctx.addressHistory;
  const ch = ctx.callerHistory;
  if (!ah && !ch) return null;

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100/90">
      <div className="mb-1 font-semibold uppercase tracking-wide text-amber-200/70">
        Pre-call RMS context{ctx.cached ? " (cached)" : ""}
      </div>
      {ah ? (
        <div>
          {ah.address}: {ah.priorIncidentCount} prior
          {ah.lastIncidentType ? ` · last ${ah.lastIncidentType}` : ""}
          {ah.lastIncidentDate ? ` (${ah.lastIncidentDate})` : ""}
          {ah.hasActiveProtectiveOrder ? " · protective order" : ""}
          {ah.hasHazardFlag ? ` · hazard${ah.hazardDescription ? `: ${ah.hazardDescription}` : ""}` : ""}
        </div>
      ) : null}
      {ch ? (
        <div className="mt-0.5">
          Caller {ch.phone}: {ch.priorCallCount} prior calls
          {ch.isKnownOffender ? " · known offender" : ""}
          {ch.hasActiveWarrant ? " · active warrant" : ""}
        </div>
      ) : null}
    </div>
  );
}
