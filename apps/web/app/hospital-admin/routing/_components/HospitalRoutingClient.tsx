"use client";

/**
 * apps/web/app/hospital-admin/routing/_components/HospitalRoutingClient.tsx
 *
 * Routing configuration page.
 * HOSPITAL_ADMIN: full edit access.
 * HOSPITAL_COORDINATOR: view-only — all inputs disabled, ViewOnly banner shown.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Loader2, Route, Save } from "lucide-react";

type RoutingRule = {
  facilityId: string;
  facilityName: string;
  priority: number;
  conditions: {
    minBedsAvailable?: number;
    diversionStatuses: Array<"OPEN" | "ALERT">;
    traumaRequired?: boolean;
    specialtyRequired?: string;
  };
};

type RoutingConfig = {
  alertThresholdBeds: number;
  diversionThresholdBeds: number;
  autoUpdateDiversionStatus: boolean;
  emsRoutingPriority: RoutingRule[];
  notifyEmsOnDiversion: boolean;
  notifyEmsOnAlert: boolean;
  diversionContactNumbers: string[];
};

async function fetchRoutingConfig(agencyId: string): Promise<RoutingConfig> {
  const r = await fetch(`/api/hospital/${agencyId}/routing/config`, { credentials: "include" });
  if (!r.ok) throw new Error(`Failed (${r.status})`);
  return r.json();
}

async function patchRoutingConfig(agencyId: string, config: Partial<RoutingConfig>) {
  const r = await fetch(`/api/hospital/${agencyId}/routing/config`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `Save failed (${r.status})`); }
  return r.json();
}

function ViewOnlyBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
      <Eye className="h-4 w-4 text-slate-500" />
      <p className="text-sm text-slate-400">
        You have <span className="font-medium text-slate-300">view-only</span> access to routing configuration.
        Contact your facility administrator to make changes.
      </p>
    </div>
  );
}

export function HospitalRoutingClient({ agencyId, canEdit }: { agencyId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["routing-config", agencyId],
    queryFn: () => fetchRoutingConfig(agencyId),
  });

  const [draft, setDraft] = useState<Partial<RoutingConfig>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const update = <K extends keyof RoutingConfig>(k: K, v: RoutingConfig[K]) => {
    if (!canEdit) return;
    setDraft(d => ({ ...d, [k]: v }));
    setIsDirty(true);
    setSavedOk(false);
  };

  const merged: RoutingConfig = {
    alertThresholdBeds:     draft.alertThresholdBeds     ?? data?.alertThresholdBeds     ?? 10,
    diversionThresholdBeds: draft.diversionThresholdBeds ?? data?.diversionThresholdBeds ?? 5,
    autoUpdateDiversionStatus: draft.autoUpdateDiversionStatus ?? data?.autoUpdateDiversionStatus ?? false,
    emsRoutingPriority:     data?.emsRoutingPriority ?? [],
    notifyEmsOnDiversion:   draft.notifyEmsOnDiversion ?? data?.notifyEmsOnDiversion ?? true,
    notifyEmsOnAlert:       draft.notifyEmsOnAlert       ?? data?.notifyEmsOnAlert       ?? false,
    diversionContactNumbers: draft.diversionContactNumbers ?? data?.diversionContactNumbers ?? [],
  };

  const mutation = useMutation({
    mutationFn: () => patchRoutingConfig(agencyId, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routing-config", agencyId] });
      setDraft({}); setIsDirty(false); setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
  });

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
    </div>
  );
  if (isError) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className="text-sm text-rose-400">Failed to load routing configuration.</p>
    </div>
  );

  const fieldClass = `w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none ${!canEdit ? "cursor-not-allowed opacity-50" : ""}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-teal-600">Hospital Portal</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Routing Configuration</h1>
        </div>

        {!canEdit && <ViewOnlyBanner />}

        <div className="space-y-6">
          {/* Diversion thresholds */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Route className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white">Diversion Thresholds</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Alert threshold — beds available
                </label>
                <input
                  type="number" min={0} max={500}
                  value={merged.alertThresholdBeds}
                  disabled={!canEdit}
                  onChange={e => update("alertThresholdBeds", Number(e.target.value))}
                  className={fieldClass}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Status changes to ALERT when available beds drops to or below this number.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Diversion threshold — beds available
                </label>
                <input
                  type="number" min={0} max={500}
                  value={merged.diversionThresholdBeds}
                  disabled={!canEdit}
                  onChange={e => update("diversionThresholdBeds", Number(e.target.value))}
                  className={fieldClass}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Status changes to DIVERSION at or below this number.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => update("autoUpdateDiversionStatus", !merged.autoUpdateDiversionStatus)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${canEdit ? "cursor-pointer" : "cursor-not-allowed"} ${merged.autoUpdateDiversionStatus ? "bg-teal-600" : "bg-slate-700"}`}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${merged.autoUpdateDiversionStatus ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Auto-update diversion status</p>
                  <p className="text-xs text-slate-500">Automatically set ALERT/DIVERSION when bed count crosses thresholds</p>
                </div>
              </label>
            </div>
          </section>

          {/* EMS notifications */}
          <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">EMS Notifications</h2>
            <div className="space-y-3">
              {[
                { key: "notifyEmsOnDiversion" as const, label: "Notify EMS dispatch on DIVERSION", desc: "Sends an alert to configured EMS contacts when diversion is activated" },
                { key: "notifyEmsOnAlert"     as const, label: "Notify EMS dispatch on ALERT",     desc: "Sends an alert when status changes to ALERT" },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start gap-3">
                  <div
                    onClick={() => update(key, !merged[key])}
                    className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${canEdit ? "cursor-pointer" : "cursor-not-allowed"} ${merged[key] ? "bg-teal-600" : "bg-slate-700"}`}
                  >
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${merged[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-300">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </label>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  EMS contact numbers (E.164, comma-separated)
                </label>
                <input
                  type="text"
                  value={merged.diversionContactNumbers.join(", ")}
                  disabled={!canEdit}
                  onChange={e => update("diversionContactNumbers", e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean))}
                  placeholder="+17065550001, +17065550002"
                  className={fieldClass}
                />
              </div>
            </div>
          </section>

          {/* EMS routing priority — view only table, edit is admin-only deep config */}
          {merged.emsRoutingPriority.length > 0 && (
            <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">EMS Routing Priority</h2>
              <div className="divide-y divide-slate-800/40">
                {merged.emsRoutingPriority.map((rule, i) => (
                  <div key={rule.facilityId} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-slate-400">
                      {i + 1}
                    </span>
                    <p className="text-sm text-white">{rule.facilityName}</p>
                    <p className="ml-auto text-xs text-slate-500">
                      ≥{rule.conditions.minBedsAvailable ?? 0} beds required
                    </p>
                  </div>
                ))}
              </div>
              {canEdit && (
                <p className="mt-3 text-xs text-slate-600">
                  Edit routing priority order via the full routing setup wizard.
                </p>
              )}
            </section>
          )}

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
                Save configuration
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
