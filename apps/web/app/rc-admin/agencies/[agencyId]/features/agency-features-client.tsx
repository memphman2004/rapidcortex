"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ADDON_CATALOG,
  getAddonByKey,
  isAddonIncludedInPlan,
  type AddonDefinition,
  type AddonKey,
  type BillingAuditEventRecord,
  type InvoiceLineItemDelta,
} from "rapid-cortex-shared";
import {
  activeTierKeyInFamily,
  addonTierFamily,
  buildAddonGridRows,
  type AddonGridRow,
} from "@/lib/addon-tier-utils";
import {
  addonAvailabilityNote,
  filterAddonCatalogForTenant,
} from "@/lib/addon-catalog-filters";
import type { Vertical } from "@/lib/vertical";
import {
  useAddonEntitlements,
  useAddonEntitlementsAudit,
  useAddonMutation,
  useCurrentInvoice,
} from "@/lib/hooks/use-addon-entitlements";
import { VerticalBadge } from "@/components/ui/VerticalBadge";

type Props = {
  tenantId: string;
  agencyName: string;
  canEdit: boolean;
  vertical?: Vertical;
  /** RC super admin — show and toggle every catalog SKU across all verticals. */
  manageAllAddons?: boolean;
  featureFlags?: Record<string, boolean>;
};

type FilterMode = "all" | "active" | "available";

type LastChangeBanner = {
  proRataCents: number;
  invoiceNumber?: string;
  addonLabel: string;
};

function formatUsd(cents: number): string {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}$${(cents / 100).toFixed(2)}`;
}

function auditEventColor(event: BillingAuditEventRecord): "green" | "red" | "amber" {
  const after = event.afterState as { enabled?: boolean } | null;
  if (typeof after?.enabled === "boolean") {
    return after.enabled ? "green" : "red";
  }
  if (event.description.includes("price") || event.description.includes("override")) {
    return "amber";
  }
  return "amber";
}

function tierLabel(key: AddonKey): string {
  const tail = key.split(".").pop() ?? key;
  return tail.replace(/^tier/, "Tier ").replace(/^\w/, (c) => c.toUpperCase());
}

function rowsByCategory(rows: AddonGridRow[]): Map<string, AddonGridRow[]> {
  const map = new Map<string, AddonGridRow[]>();
  for (const row of rows) {
    const cat = row.kind === "single" ? row.def.category : (row.variants[0]?.category ?? "Other");
    const list = map.get(cat) ?? [];
    list.push(row);
    map.set(cat, list);
  }
  return map;
}

function invoiceNumberFromRecord(invoice: Record<string, unknown> | null | undefined): string | undefined {
  if (!invoice) return undefined;
  const n = invoice.invoiceNumber ?? invoice.number ?? invoice.invoiceId;
  return typeof n === "string" ? n : undefined;
}

export function AgencyFeaturesClient({
  tenantId,
  agencyName,
  canEdit,
  vertical = "core",
  manageAllAddons = false,
  featureFlags = {},
}: Props) {
  const { data, isLoading, error, refetch, isFetching } = useAddonEntitlements(tenantId);
  const { data: invoiceData } = useCurrentInvoice(tenantId);
  const mutation = useAddonMutation(tenantId);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [banner, setBanner] = useState<LastChangeBanner | null>(null);
  const [auditLimit, setAuditLimit] = useState(20);
  const { data: auditData } = useAddonEntitlementsAudit(tenantId, auditLimit);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});

  const visibleCatalog = useMemo(() => {
    const catalog = data?.catalog ?? ADDON_CATALOG;
    return filterAddonCatalogForTenant(catalog, {
      vertical,
      featureFlags,
      manageAllAddons,
    });
  }, [data?.catalog, vertical, featureFlags, manageAllAddons]);

  const gridRows = useMemo(() => {
    if (!data && isLoading) return [];
    const rows = buildAddonGridRows(visibleCatalog);
    if (filter === "all" || !data) return rows;
    return rows.filter((row) => {
      const keys =
        row.kind === "single"
          ? [row.def.key]
          : row.variants.map((v) => v.key);
      return keys.some((key) => {
        const def = getAddonByKey(key);
        const state = data.entitlements.addons[key];
        const included = isAddonIncludedInPlan(def, data.entitlements.plan);
        const active = included || Boolean(state?.enabled);
        if (filter === "active") return active;
        return !active && !included;
      });
    });
  }, [data, filter, visibleCatalog, isLoading]);

  const grouped = useMemo(() => rowsByCategory(gridRows), [gridRows]);

  if (isLoading) return <p className="text-sm text-slate-400">Loading feature add-ons…</p>;
  if (error || !data) {
    const fallbackRows = buildAddonGridRows(
      filterAddonCatalogForTenant(ADDON_CATALOG, { vertical, featureFlags, manageAllAddons }),
    );
    const fallbackGrouped = rowsByCategory(fallbackRows);
    const errorDetail = error instanceof Error ? error.message : "Unknown error";

    return (
      <div className="space-y-6">
        <div className="rounded-md border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <p>
            Could not load entitlements{errorDetail ? `: ${errorDetail}` : ""}. Showing catalog-only
            fallback; toggles are disabled until data loads.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-2 rounded border border-rose-800/80 px-2.5 py-1 text-xs text-rose-100 hover:bg-rose-950/50 disabled:opacity-50"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
        <div className="space-y-6">
          {[...fallbackGrouped.entries()].map(([category, rows]) => (
            <section
              key={category}
              className="overflow-hidden rounded-lg border border-slate-800"
              style={{ borderTop: "2px solid var(--role-accent)" }}
            >
              <div
                className="px-4 py-2 text-sm font-medium"
                style={{
                  color: "var(--role-text-accent)",
                  backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 65%, rgb(2 6 23))",
                }}
              >
                {category}
              </div>
              <ul className="divide-y divide-slate-800">
                {rows.map((row) => {
                  if (row.kind === "tiered") {
                    const defaultVariant = row.variants[0]!;
                    return (
                      <li
                        key={row.family}
                        className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/20 px-4 py-3 opacity-80"
                      >
                        <div className="min-w-[200px] flex-1">
                          <p className="font-medium text-slate-100">{defaultVariant.name.replace(/\s+\w+$/, "")}</p>
                          <p className="text-xs text-slate-400">{defaultVariant.description}</p>
                        </div>
                        <select
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-400"
                          value={defaultVariant.key}
                          disabled
                        >
                          {row.variants.map((v) => (
                            <option key={v.key} value={v.key}>
                              {tierLabel(v.key)} —{" "}
                              {v.billingType === "monthly" ? `$${v.monthlyPrice}/mo` : `$${v.oneTimePrice}`}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                          <input type="checkbox" checked={false} disabled />
                          Off
                        </label>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={row.def.key}
                      className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/20 px-4 py-3 opacity-80"
                    >
                      <div className="min-w-[200px] flex-1">
                        <p className="font-medium text-slate-100">{row.def.name}</p>
                        <p className="text-xs text-slate-400">{row.def.description}</p>
                      </div>
                      <p className="text-sm text-slate-400">
                        {row.def.billingType === "monthly"
                          ? `$${row.def.monthlyPrice}/mo`
                          : `$${row.def.oneTimePrice} one-time`}
                      </p>
                      <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input type="checkbox" checked={false} disabled />
                        Off
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const { entitlements } = data;
  const activeCount = Object.values(entitlements.addons).filter((a) => a.enabled).length;
  const openInvoice = invoiceData?.invoice as Record<string, unknown> | null | undefined;
  const openInvoiceNumber = invoiceNumberFromRecord(openInvoice);

  async function applyPatch(
    body: Parameters<typeof mutation.mutateAsync>[0],
    addonLabel: string,
  ) {
    try {
      const result = await mutation.mutateAsync(body);
      const delta = result.invoiceDelta as unknown as InvoiceLineItemDelta;
      const proRataCents = Number(delta?.proRataAdjustmentCents ?? 0);
      setBanner({
        proRataCents,
        invoiceNumber: openInvoiceNumber,
        addonLabel,
      });
    } catch (err) {
      setBanner(null);
      const detail = err instanceof Error ? err.message : "Unknown error";
      window.alert(`Update failed: ${detail}`);
    }
  }

  async function onToggle(def: AddonDefinition, enabled: boolean) {
    if (!canEdit) return;
    if (enabled && def.billingType === "monthly") {
      const ok = window.confirm(
        `Enable ${def.name}? This will update the current invoice (pro-rated for the remainder of the billing cycle).`,
      );
      if (!ok) return;
    }
    if (!enabled && def.billingType === "monthly") {
      const ok = window.confirm(
        `Disable ${def.name}? This will remove the add-on from billing immediately.`,
      );
      if (!ok) return;
    }
    await applyPatch(
      {
        addonKey: def.key,
        enabled,
        ...(enabled ? {} : { forceImmediateDisable: true }),
      },
      def.name,
    );
  }

  async function onTierChange(variants: AddonDefinition[], newKey: AddonKey) {
    if (!canEdit) return;
    const current = activeTierKeyInFamily(
      addonTierFamily(newKey),
      variants,
      entitlements.addons,
      entitlements.plan,
      isAddonIncludedInPlan,
    );
    const def = getAddonByKey(newKey);
    if (current === newKey) return;
    if (current) {
      await applyPatch(
        { addonKey: current as AddonKey, enabled: false, forceImmediateDisable: true },
        getAddonByKey(current as AddonKey).name,
      );
    }
    await applyPatch({ addonKey: newKey, enabled: true }, def.name);
  }

  async function onOverrideBlur(def: AddonDefinition, raw: string) {
    if (!canEdit) return;
    const state = entitlements.addons[def.key];
    const trimmed = raw.trim();
    if (!trimmed) {
      if (state?.overridePriceCents) {
        await applyPatch({ addonKey: def.key, enabled: Boolean(state.enabled) }, def.name);
      }
      return;
    }
    const dollars = Number.parseFloat(trimmed);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    await applyPatch(
      {
        addonKey: def.key,
        enabled: Boolean(state?.enabled),
        overridePrice: dollars,
      },
      def.name,
    );
  }

  function renderAvailabilityNote(def: AddonDefinition) {
    if (!manageAllAddons) return null;
    const note = addonAvailabilityNote(def, vertical, featureFlags);
    if (!note) return null;
    return (
      <p className="mt-1 text-[10px] text-amber-300/90" title={note}>
        {note}
      </p>
    );
  }

  function renderRow(row: AddonGridRow) {
    if (row.kind === "tiered") {
      const activeKey = activeTierKeyInFamily(
        row.family,
        row.variants,
        entitlements.addons,
        entitlements.plan,
        isAddonIncludedInPlan,
      );
      const activeDef = activeKey ? getAddonByKey(activeKey) : row.variants[0];
      const included = row.variants.some((v) => isAddonIncludedInPlan(v, entitlements.plan));
      const state = activeKey ? entitlements.addons[activeKey] : undefined;
      const enabled = included || Boolean(state?.enabled);
      const displayDef = activeDef ?? row.variants[0]!;

      return (
        <li
          key={row.family}
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
            enabled ? "bg-slate-950/40" : "bg-slate-950/20 opacity-80"
          }`}
        >
          <div className="min-w-[200px] flex-1">
            <p className="font-medium text-slate-100">{displayDef.name.replace(/\s+\w+$/, "")}</p>
            <p className="text-xs text-slate-400">{displayDef.description}</p>
            {renderAvailabilityNote(displayDef)}
          </div>
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
            value={activeKey || row.variants[0]!.key}
            disabled={!canEdit || included || mutation.isPending}
            onChange={(e) => void onTierChange(row.variants, e.target.value as AddonKey)}
          >
            {row.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {tierLabel(v.key)} —{" "}
                {v.billingType === "monthly" ? `$${v.monthlyPrice}/mo` : `$${v.oneTimePrice}`}
              </option>
            ))}
          </select>
          {included ? (
            <span className="rounded bg-emerald-900/50 px-2 py-1 text-xs text-emerald-200">
              Included in {entitlements.plan}
            </span>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={Boolean(state?.enabled)}
                disabled={!canEdit || mutation.isPending}
                onChange={(e) => void onToggle(displayDef, e.target.checked)}
              />
              {state?.enabled ? "On" : "Off"}
            </label>
          )}
          {!included && canEdit ? (
            <OverridePriceInput
              def={displayDef}
              stateCents={state?.overridePriceCents}
              draft={overrideDrafts[displayDef.key]}
              onDraftChange={(v) => setOverrideDrafts((d) => ({ ...d, [displayDef.key]: v }))}
              onBlur={(v) => void onOverrideBlur(displayDef, v)}
            />
          ) : null}
        </li>
      );
    }

    const { def } = row;
    const state = entitlements.addons[def.key];
    const included = isAddonIncludedInPlan(def, entitlements.plan);
    const enabled = included || Boolean(state?.enabled);

    return (
      <li
        key={def.key}
        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
          enabled ? "bg-slate-950/40" : "bg-slate-950/20 opacity-80"
        }`}
      >
        <div className="min-w-[200px] flex-1">
          <p className="font-medium text-slate-100">{def.name}</p>
          <p className="text-xs text-slate-400">{def.description}</p>
          {renderAvailabilityNote(def)}
        </div>
        <p className="text-sm text-slate-300">
          {state?.overridePriceCents != null ? (
            <>
              <span className="text-amber-300">${(state.overridePriceCents / 100).toFixed(2)}</span>
              <span className="ml-1 text-slate-500 line-through">
                {def.billingType === "monthly" ? `$${def.monthlyPrice}/mo` : `$${def.oneTimePrice}`}
              </span>
            </>
          ) : def.billingType === "monthly" ? (
            `$${def.monthlyPrice}/mo`
          ) : (
            `$${def.oneTimePrice} one-time`
          )}
        </p>
        {included ? (
          <span className="rounded bg-emerald-900/50 px-2 py-1 text-xs text-emerald-200">
            Included in {entitlements.plan}
          </span>
        ) : (
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(state?.enabled)}
              disabled={!canEdit || mutation.isPending}
              onChange={(e) => void onToggle(def, e.target.checked)}
            />
            {state?.enabled ? "On" : "Off"}
          </label>
        )}
        {!included && canEdit ? (
          <OverridePriceInput
            def={def}
            stateCents={state?.overridePriceCents}
            draft={overrideDrafts[def.key]}
            onDraftChange={(v) => setOverrideDrafts((d) => ({ ...d, [def.key]: v }))}
            onBlur={(v) => void onOverrideBlur(def, v)}
          />
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/rc-admin/agencies"
          className="hover:opacity-90"
          style={{ color: "var(--role-accent)" }}
        >
          ← All agencies
        </Link>
        {vertical ? <VerticalBadge vertical={vertical} size="xs" /> : null}
        {manageAllAddons ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
            style={{
              color: "var(--role-text-accent)",
              backgroundColor: "color-mix(in srgb, var(--role-badge-bg) 40%, rgb(2 6 23))",
              borderColor: "color-mix(in srgb, var(--role-accent) 45%, transparent)",
            }}
          >
            Full catalog (platform admin)
          </span>
        ) : null}
        <span
          className="rounded-full px-3 py-1"
          style={{
            color: "var(--role-text-accent)",
            backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 50%, rgb(2 6 23))",
          }}
        >
          {entitlements.plan}
        </span>
        <span className="text-slate-400">Active add-ons: {activeCount}</span>
      </div>

      {banner ? (
        <div
          className="rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--role-accent) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 45%, rgb(2 6 23))",
            color: "var(--role-text-accent)",
          }}
        >
          <p>
            <strong>{banner.addonLabel}</strong> updated — pro-rata impact{" "}
            <span className="font-mono">{formatUsd(banner.proRataCents)}</span>
            {banner.invoiceNumber ? (
              <>
                {" "}
                on invoice <span className="font-mono">#{banner.invoiceNumber}</span>
              </>
            ) : openInvoiceNumber ? (
              <>
                {" "}
                on invoice <span className="font-mono">#{openInvoiceNumber}</span>
              </>
            ) : null}
          </p>
          <Link
            href={`/rc-admin/agencies/${encodeURIComponent(tenantId)}/billing`}
            className="mt-2 inline-block underline hover:opacity-90"
            style={{ color: "var(--role-accent)" }}
          >
            View invoice →
          </Link>
        </div>
      ) : null}

      {Array.isArray(openInvoice?.addonLineItems) &&
      (openInvoice.addonLineItems as Array<Record<string, unknown>>).length > 0 ? (
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Add-on line items (open invoice
            {openInvoiceNumber ? ` #${openInvoiceNumber}` : ""})
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {(openInvoice.addonLineItems as Array<Record<string, unknown>>).map((row) => {
              const addonKey = String(row.addonKey ?? "");
              const name = addonKey ? getAddonByKey(addonKey as AddonKey).name : String(row.description ?? "Add-on");
              const monthly = Number(row.monthlyAmountCents ?? row.amountCents ?? 0) / 100;
              const proRata = Number(row.proRataCents ?? 0) / 100;
              return (
                <li key={String(row.lineItemId ?? addonKey)} className="flex flex-wrap justify-between gap-2">
                  <span>{name}</span>
                  <span className="text-slate-400">
                    ${monthly.toFixed(2)}/mo
                    {proRata !== 0 ? ` · pro-rata $${proRata.toFixed(2)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        {(["all", "active", "available"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filter === mode
                ? "text-white"
                : "bg-slate-800 text-slate-300"
            }`}
            style={
              filter === mode
                ? { backgroundColor: "var(--role-badge-bg)" }
                : undefined
            }
          >
            {mode === "all" ? "All features" : mode === "active" ? "Active only" : "Available to add"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {grouped.size === 0 ? (
          <p className="text-sm text-slate-400">No add-ons match this filter for this tenant.</p>
        ) : null}
        {[...grouped.entries()].map(([category, rows]) => (
          <section
            key={category}
            className="overflow-hidden rounded-lg border border-slate-800"
            style={{ borderTop: "2px solid var(--role-accent)" }}
          >
            <div
              className="px-4 py-2 text-sm font-medium"
              style={{
                color: "var(--role-text-accent)",
                backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 65%, rgb(2 6 23))",
              }}
            >
              {category}
            </div>
            <ul className="divide-y divide-slate-800">{rows.map((row) => renderRow(row))}</ul>
          </section>
        ))}
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Change history</h2>
        <ul className="mt-3 space-y-3">
          {(auditData?.items ?? []).map((ev) => {
            const color = auditEventColor(ev);
            const dot =
              color === "green"
                ? "bg-emerald-500"
                : color === "red"
                  ? "bg-rose-500"
                  : "bg-amber-500";
            return (
              <li key={ev.billingAuditEventId} className="flex gap-3 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                <div>
                  <p className="text-slate-200">{ev.description}</p>
                  <p className="text-xs text-slate-500">
                    {ev.actorRole} · {ev.actorUserId} · {new Date(ev.timestamp).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {auditLimit < 100 && (auditData?.items?.length ?? 0) >= auditLimit ? (
          <button
            type="button"
            className="mt-4 text-sm hover:opacity-90"
            style={{ color: "var(--role-accent)" }}
            onClick={() => setAuditLimit((n) => n + 20)}
          >
            Load more
          </button>
        ) : null}
      </section>
    </div>
  );
}

function OverridePriceInput({
  def,
  stateCents,
  draft,
  onDraftChange,
  onBlur,
}: {
  def: AddonDefinition;
  stateCents?: number;
  draft?: string;
  onDraftChange: (v: string) => void;
  onBlur: (v: string) => void;
}) {
  const catalog =
    def.billingType === "monthly" ? String(def.monthlyPrice) : String(def.oneTimePrice);
  const value = draft ?? (stateCents != null ? (stateCents / 100).toFixed(2) : "");
  const overrideActive = stateCents != null && draft === undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        type="number"
        min={0}
        step={0.01}
        placeholder={catalog}
        className="w-28 rounded border border-orange-600/70 bg-slate-900 px-2 py-1 text-right text-sm text-orange-100"
        value={value}
        onChange={(e) => onDraftChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
      {overrideActive ? (
        <span className="text-xs text-orange-300">Override active</span>
      ) : (
        <span className="text-xs text-slate-500">USD override</span>
      )}
    </div>
  );
}
