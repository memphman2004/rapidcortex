"use client";

import { useQuery } from "@tanstack/react-query";
import { ESCORT_IQ_PRODUCT_NAME, ESCORT_IQ_TAGLINE } from "rapid-cortex-shared";
import { isEscortIqEnabled } from "@/lib/runtime-flags";

type EscortItem = {
  escortId: string;
  referenceCode: string;
  status: string;
  methods: string[];
  destination?: { description?: string };
  requestedAt: string;
  assignedEscortDisplayName?: string;
  oversightStatus?: string;
  pickupEtaAt?: string;
  safetyPointName?: string;
};

async function fetchEscorts(campusCode: string): Promise<EscortItem[]> {
  const res = await fetch(
    `/api/campus/${encodeURIComponent(campusCode)}/escort-iq`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Escort list failed (${res.status})`);
  }
  const body = (await res.json()) as { items?: EscortItem[] };
  return body.items ?? [];
}

export function EscortIqOpsClient({ campusCode }: { campusCode: string }) {
  const flagOn = isEscortIqEnabled();
  const q = useQuery({
    queryKey: ["escort-iq", campusCode],
    queryFn: () => fetchEscorts(campusCode),
    enabled: flagOn,
    refetchInterval: 10_000,
  });

  if (!flagOn) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
        Escort iQ is disabled on this deployment. Set{" "}
        <code className="text-slate-300">NEXT_PUBLIC_ENABLE_ESCORT_IQ=1</code> and{" "}
        <code className="text-slate-300">ENABLE_ESCORT_IQ=true</code>, then enable it in Campus
        Settings for this higher-education tenant.
      </div>
    );
  }

  const items = q.data ?? [];
  const pending = items.filter((i) => i.status === "REQUESTED" || i.status === "ACKNOWLEDGED").length;
  const active = items.filter((i) => i.status === "ACTIVE" || i.status === "ASSIGNED").length;
  const awaitingConfirm = items.filter((i) => i.status === "ARRIVED_PENDING_CONFIRMATION").length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-100">{ESCORT_IQ_PRODUCT_NAME}</h1>
        <p className="mt-1 text-sm text-slate-400">{ESCORT_IQ_TAGLINE}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pending requests" value={pending} />
        <Metric label="Active escorts" value={active} />
        <Metric label="Awaiting student confirmation" value={awaitingConfirm} />
      </div>

      {q.isError ? (
        <p className="text-sm text-rose-300" role="alert">
          {(q.error as Error).message}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Escort session queue
        </div>
        {q.isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No escort sessions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((item) => (
              <li key={item.escortId} className="px-4 py-3 text-sm text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sky-300">{item.referenceCode}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-300">
                  {item.safetyPointName ?? "Scan point"} → {item.destination?.description ?? "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.methods?.join(" · ")}
                  {item.assignedEscortDisplayName
                    ? ` · Assigned: ${item.assignedEscortDisplayName}`
                    : ""}
                  {item.oversightStatus ? ` · Oversight: ${item.oversightStatus}` : ""}
                  {" · "}
                  {new Date(item.requestedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
