"use client";

/**
 * apps/web/app/hospital-admin/capacity/_components/HospitalCapacityClient.tsx
 *
 * Full capacity management page.
 * Both HOSPITAL_ADMIN and HOSPITAL_COORDINATOR can update capacity.
 * HOSPITAL_STAFF use /hospital-staff/* for a simpler interface.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bed, CheckCircle2, ChevronDown, Clock, Loader2, Save, AlertTriangle,
} from "lucide-react";

type DiversionStatus = "OPEN" | "ALERT" | "DIVERSION";

type CapacityRecord = {
  facilityId: string;
  facilityName: string;
  diversionStatus: DiversionStatus;
  bedsAvailable: number;
  bedsTotal: number;
  traumaCapacity: "OPEN" | "LIMITED" | "CLOSED";
  specialtyStatus: {
    icu: "OPEN" | "FULL";
    pediatric: "OPEN" | "FULL";
    burn: "OPEN" | "FULL" | "NA";
  };
  notes: string;
  lastUpdatedAt: string;
  updatedByName: string | null;
};

type CapacityHistoryEntry = {
  entryId: string;
  bedsAvailable: number;
  diversionStatus: DiversionStatus;
  updatedByName: string;
  timestamp: string;
  notes: string | null;
};

type CapacityUpdate = {
  bedsAvailable: number;
  diversionStatus: DiversionStatus;
  traumaCapacity: "OPEN" | "LIMITED" | "CLOSED";
  specialtyStatus?: CapacityRecord["specialtyStatus"];
  notes: string;
};

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchCapacity(agencyId: string): Promise<CapacityRecord> {
  const r = await fetch(`/api/hospital/${agencyId}/capacity/current`, { credentials: "include" });
  if (!r.ok) throw new Error(`Failed (${r.status})`);
  return r.json();
}

async function fetchHistory(agencyId: string): Promise<CapacityHistoryEntry[]> {
  const r = await fetch(`/api/hospital/${agencyId}/capacity/history?limit=20`, { credentials: "include" });
  if (!r.ok) throw new Error(`Failed (${r.status})`);
  const d = await r.json();
  return d.entries ?? [];
}

async function patchCapacity(agencyId: string, update: CapacityUpdate) {
  const r = await fetch(`/api/hospital/${agencyId}/capacity`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error ?? `Save failed (${r.status})`);
  }
  return r.json();
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DiversionStatus, string> = {
  OPEN:      "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  ALERT:     "border-yellow-700 bg-yellow-900/20 text-yellow-300",
  DIVERSION: "border-rose-700 bg-rose-900/20 text-rose-300",
};

const STATUS_DESCRIPTIONS: Record<DiversionStatus, string> = {
  OPEN:      "Accepting all incoming EMS transport",
  ALERT:     "Limited capacity — EMS should consider alternatives",
  DIVERSION: "Not accepting EMS transport — redirect to other facilities",
};

// ─── Specialty toggle ─────────────────────────────────────────────────────────

function SpecialtyToggle({
  label, value, onChange,
}: {
  label: string;
  value: "OPEN" | "FULL" | "NA";
  onChange: (v: "OPEN" | "FULL") => void;
}) {
  if (value === "NA") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2.5">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-xs text-slate-600">N/A</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
      <span className="text-sm text-white">{label}</span>
      <div className="flex gap-1">
        {(["OPEN", "FULL"] as const).map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              value === opt
                ? opt === "OPEN"
                  ? "bg-emerald-800 text-emerald-200"
                  : "bg-rose-900 text-rose-300"
                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HospitalCapacityClient({
  agencyId, canEdit, role,
}: {
  agencyId: string;
  canEdit: boolean;
  role: string;
}) {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["facility-capacity", agencyId],
    queryFn: () => fetchCapacity(agencyId),
    refetchInterval: 60_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["capacity-history", agencyId],
    queryFn: () => fetchHistory(agencyId),
  });

  // Draft state
  const [draft, setDraft] = useState<Partial<CapacityUpdate>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const merged: CapacityUpdate = {
    bedsAvailable: draft.bedsAvailable ?? data?.bedsAvailable ?? 0,
    diversionStatus: draft.diversionStatus ?? data?.diversionStatus ?? "OPEN",
    traumaCapacity: draft.traumaCapacity ?? data?.traumaCapacity ?? "OPEN",
    specialtyStatus: draft.specialtyStatus ?? data?.specialtyStatus ?? { icu: "OPEN", pediatric: "OPEN", burn: "NA" },
    notes: draft.notes ?? data?.notes ?? "",
  };

  const update = <K extends keyof CapacityUpdate>(key: K, val: CapacityUpdate[K]) => {
    setDraft(d => ({ ...d, [key]: val }));
    setIsDirty(true);
    setSavedOk(false);
  };

  const mutation = useMutation({
    mutationFn: () => patchCapacity(agencyId, merged),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facility-capacity", agencyId] });
      qc.invalidateQueries({ queryKey: ["capacity-history", agencyId] });
      setDraft({});
      setIsDirty(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-slate-950">
        <p className="text-sm text-rose-400">Failed to load capacity data.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
            {data.facilityName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Capacity Management</h1>
          {!canEdit && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">View Only</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Update form */}
          <div className="col-span-12 space-y-5 xl:col-span-7">

            {/* Bed count */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Bed className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-white">Available Beds</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    disabled={!canEdit || merged.bedsAvailable <= 0}
                    onClick={() => update("bedsAvailable", Math.max(0, merged.bedsAvailable - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xl text-white hover:bg-slate-700 disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={data.bedsTotal}
                    value={merged.bedsAvailable}
                    disabled={!canEdit}
                    onChange={e => update("bedsAvailable", Math.max(0, Math.min(data.bedsTotal, Number(e.target.value))))}
                    className="w-20 rounded-lg border border-slate-700 bg-slate-800 py-2 text-center text-2xl font-bold text-white focus:border-teal-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    disabled={!canEdit || merged.bedsAvailable >= data.bedsTotal}
                    onClick={() => update("bedsAvailable", Math.min(data.bedsTotal, merged.bedsAvailable + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xl text-white hover:bg-slate-700 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm text-slate-400">of {data.bedsTotal} total beds</p>
              </div>
            </section>

            {/* Diversion status */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">Diversion Status</h2>
              <div className="space-y-2">
                {(["OPEN", "ALERT", "DIVERSION"] as const).map(s => (
                  <button
                    key={s}
                    disabled={!canEdit}
                    onClick={() => update("diversionStatus", s)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed ${
                      merged.diversionStatus === s
                        ? STATUS_STYLES[s]
                        : "border-slate-800 bg-slate-800/30 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className={`mt-0.5 h-3 w-3 rounded-full flex-shrink-0 ${
                      s === "OPEN" ? "bg-emerald-400" : s === "ALERT" ? "bg-yellow-400" : "bg-rose-500"
                    }`} />
                    <div>
                      <p className="text-sm font-semibold">{s}</p>
                      <p className={`mt-0.5 text-xs ${merged.diversionStatus === s ? "opacity-70" : "text-slate-500"}`}>
                        {STATUS_DESCRIPTIONS[s]}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Trauma + specialty */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">Specialty Capacity</h2>
              <div className="space-y-2">
                {/* Trauma */}
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                  <span className="text-sm font-medium text-white">Trauma</span>
                  <div className="flex gap-1">
                    {(["OPEN", "LIMITED", "CLOSED"] as const).map(opt => (
                      <button
                        key={opt}
                        disabled={!canEdit}
                        onClick={() => update("traumaCapacity", opt)}
                        className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed ${
                          merged.traumaCapacity === opt
                            ? opt === "OPEN" ? "bg-emerald-800 text-emerald-200"
                              : opt === "LIMITED" ? "bg-yellow-900 text-yellow-300"
                              : "bg-rose-900 text-rose-300"
                            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <SpecialtyToggle
                  label="ICU"
                  value={merged.specialtyStatus?.icu ?? "OPEN"}
                  onChange={v => update("specialtyStatus", { ...(merged.specialtyStatus ?? { icu: "OPEN", pediatric: "OPEN", burn: "NA" }), icu: v })}
                />
                <SpecialtyToggle
                  label="Pediatric"
                  value={merged.specialtyStatus?.pediatric ?? "OPEN"}
                  onChange={v => update("specialtyStatus", { ...(merged.specialtyStatus ?? { icu: "OPEN", pediatric: "OPEN", burn: "NA" }), pediatric: v })}
                />
                <SpecialtyToggle
                  label="Burn"
                  value={merged.specialtyStatus?.burn ?? "NA"}
                  onChange={v => update("specialtyStatus", { ...(merged.specialtyStatus ?? { icu: "OPEN", pediatric: "OPEN", burn: "NA" }), burn: v })}
                />
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
              <h2 className="mb-3 text-sm font-semibold text-white">Update Note</h2>
              <textarea
                value={merged.notes}
                disabled={!canEdit}
                onChange={e => update("notes", e.target.value)}
                placeholder="Optional — describe the reason for this update"
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none disabled:opacity-50"
              />
            </section>

            {/* Save */}
            {canEdit && isDirty && (
              <div className="flex items-center justify-between rounded-xl border border-teal-800/50 bg-teal-900/20 px-4 py-3">
                <p className="text-sm text-teal-300">Unsaved changes</p>
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {mutation.isPending ? "Saving…" : "Save update"}
                </button>
              </div>
            )}
            {savedOk && !isDirty && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-800/40 bg-emerald-900/10 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">Capacity updated successfully</p>
              </div>
            )}
            {mutation.isError && (
              <div className="rounded-xl border border-rose-800/40 bg-rose-900/10 px-4 py-3">
                <p className="text-sm text-rose-400">{(mutation.error as Error).message}</p>
              </div>
            )}
          </div>

          {/* Right: Update history */}
          <div className="col-span-12 xl:col-span-5">
            <div className="sticky top-6 rounded-xl border border-slate-700/60 bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Update History
                </span>
              </div>
              <div className="max-h-[600px] divide-y divide-slate-800/40 overflow-auto">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-600">No updates yet</div>
                ) : history.map(entry => {
                  const cfg = {
                    OPEN:      "text-emerald-400",
                    ALERT:     "text-yellow-400",
                    DIVERSION: "text-rose-400",
                  }[entry.diversionStatus] ?? "text-slate-400";
                  return (
                    <div key={entry.entryId} className="px-4 py-3">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-semibold text-white">{entry.bedsAvailable} beds</p>
                        <p className={`text-xs font-medium ${cfg}`}>{entry.diversionStatus}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {entry.updatedByName} · {new Date(entry.timestamp).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                      {entry.notes && (
                        <p className="mt-1 text-xs italic text-slate-600">{entry.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
