"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADDON_CATALOG, type AddonDefinition } from "rapid-cortex-shared";
import {
  deleteAdminTenantAddon,
  fetchAdminTenantAddons,
  fetchAdminTenantEntitlementsAudit,
  postAdminTenantAddon,
} from "@/lib/api";
import { buildAddonGridRows } from "@/lib/addon-tier-utils";
import { VerticalBadge, type Vertical as TenantVertical } from "@/components/ui/VerticalBadge";
import { features } from "@/lib/features";

type Props = {
  agencyId: string;
  agencyName: string;
  vertical: TenantVertical;
  featureFlags?: Record<string, boolean>;
};

type DisablePrompt = { addonKey: string; label: string } | null;

function pricingNote(def: AddonDefinition): string {
  return def.billingType === "monthly" ? "Recurring monthly add-on tier" : "One-time implementation SKU";
}

function isFeatureFlagEnabled(def: AddonDefinition, featureFlags?: Record<string, boolean>): boolean {
  if (!def.featureFlag) return true;
  return Boolean(featureFlags?.[def.featureFlag]);
}

function matchesVertical(def: AddonDefinition, vertical: TenantVertical): boolean {
  if (!def.verticalRequired) return true;
  return def.verticalRequired === vertical;
}

function verticalLabel(vertical: string): string {
  return vertical.charAt(0).toUpperCase() + vertical.slice(1);
}

export function TenantAddonPanel({ agencyId, agencyName, vertical, featureFlags }: Props) {
  if (!features.addonManagement) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
        Add-on management is disabled in this environment.
      </div>
    );
  }
  const qc = useQueryClient();
  const [disablePrompt, setDisablePrompt] = useState<DisablePrompt>(null);

  const addonsQuery = useQuery({
    queryKey: ["tenant-addons", agencyId],
    queryFn: () => fetchAdminTenantAddons(agencyId),
  });
  const auditQuery = useQuery({
    queryKey: ["tenant-addon-audit", agencyId],
    queryFn: () => fetchAdminTenantEntitlementsAudit(agencyId, 50),
  });

  const enabled = useMemo(
    () => new Set((addonsQuery.data?.addons ?? []).map((key) => key.toLowerCase())),
    [addonsQuery.data?.addons],
  );
  const rows = useMemo(() => buildAddonGridRows(ADDON_CATALOG), []);

  const mutation = useMutation({
    mutationFn: async (payload: { addonKey: string; enable: boolean }) => {
      if (payload.enable) return postAdminTenantAddon(agencyId, payload.addonKey);
      return deleteAdminTenantAddon(agencyId, payload.addonKey);
    },
    onMutate: async ({ addonKey, enable }) => {
      await qc.cancelQueries({ queryKey: ["tenant-addons", agencyId] });
      const prev = qc.getQueryData<{ agencyId: string; addons: string[] }>(["tenant-addons", agencyId]);
      const next = new Set((prev?.addons ?? []).map((k) => k.toLowerCase()));
      if (enable) next.add(addonKey.toLowerCase());
      else next.delete(addonKey.toLowerCase());
      qc.setQueryData(["tenant-addons", agencyId], { agencyId, addons: Array.from(next) });
      return { prev };
    },
    onError: (_e, _payload, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tenant-addons", agencyId], ctx.prev);
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tenant-addons", agencyId] }),
        qc.invalidateQueries({ queryKey: ["tenant-addon-audit", agencyId] }),
      ]);
    },
  });

  const isBusy = mutation.isPending;

  function toggleAddon(def: AddonDefinition, enable: boolean) {
    if (!enable) {
      setDisablePrompt({ addonKey: def.key, label: def.name });
      return;
    }
    void mutation.mutateAsync({ addonKey: def.key, enable: true });
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Tenant Add-ons</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>
            {agencyName} ({agencyId})
          </span>
          <VerticalBadge vertical={vertical} size="xs" />
        </div>
      </header>

      {addonsQuery.isLoading ? <p className="text-sm text-slate-500">Loading add-ons…</p> : null}
      {addonsQuery.isError ? (
        <p className="text-sm text-rose-300">Failed to load add-ons.</p>
      ) : null}

      {!addonsQuery.isLoading && !addonsQuery.isError ? (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const defs = row.kind === "single" ? [row.def] : row.variants;
            const key = row.kind === "single" ? row.def.key : row.family;
            return (
              <article key={key} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {row.kind === "single" ? row.def.name : `${row.family} tiers`}
                </h2>
                <div className="mt-3 space-y-2">
                  {defs.map((def) => {
                    const isOn = enabled.has(def.key.toLowerCase());
                    const verticalOk = matchesVertical(def, vertical);
                    const flagOk = isFeatureFlagEnabled(def, featureFlags);
                    const isLocked = !verticalOk || !flagOk;
                    const lockReason = !verticalOk
                      ? `Requires RC ${verticalLabel(def.verticalRequired!)} vertical`
                      : def.featureFlag && !flagOk
                        ? `Requires feature flag ${def.featureFlag}`
                        : "";
                    return (
                      <div
                        key={def.key}
                        title={lockReason || undefined}
                        className={`rounded border p-2 ${
                          isOn ? "border-sky-500/60 bg-sky-900/20" : "border-slate-800 bg-slate-900/20"
                        } ${isLocked ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-white">{def.name}</p>
                            <p className="text-[11px] text-slate-400">{def.description}</p>
                            <p className="mt-1 text-[10px] text-slate-500">{pricingNote(def)}</p>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={isOn}
                              disabled={isBusy || isLocked}
                              onChange={(e) => toggleAddon(def, e.target.checked)}
                            />
                            {isOn ? "Enabled" : "Disabled"}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Audit log</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {(auditQuery.data?.items ?? []).map((ev) => (
            <li key={ev.billingAuditEventId}>
              <p>{ev.description}</p>
              <p className="text-xs text-slate-500">
                {ev.actorRole} · {ev.actorUserId} · {new Date(ev.timestamp).toLocaleString()}
              </p>
            </li>
          ))}
          {!auditQuery.data?.items?.length ? (
            <li className="text-xs text-slate-500">No add-on audit events yet.</li>
          ) : null}
        </ul>
      </section>

      {disablePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-rose-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-white">Disable add-on?</h3>
            <p className="mt-1 text-sm text-slate-300">
              This will disable <strong>{disablePrompt.label}</strong> for {agencyName}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
                onClick={() => setDisablePrompt(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-rose-700 px-3 py-1.5 text-sm text-white"
                onClick={() => {
                  void mutation.mutateAsync({ addonKey: disablePrompt.addonKey, enable: false });
                  setDisablePrompt(null);
                }}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

