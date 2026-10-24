"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ADDON_CATALOG,
  getAddonByKey,
  isAddonActiveForTenant,
  entitledMonthlyInvoiceAddons,
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
  monthly: boolean;
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

function priceText(
  def: AddonDefinition,
  state: { overridePriceCents?: number } | undefined,
  plan: string,
  included: boolean,
  enabled: boolean,
): string {
  if (state?.overridePriceCents != null) {
    const custom = (state.overridePriceCents / 100).toFixed(2);
    const list = def.billingType === "monthly" ? `$${def.monthlyPrice}/mo` : `$${def.oneTimePrice}`;
    const onInvoice = def.billingType === "monthly" && enabled && !included ? ", on the monthly invoice" : "";
    return `Custom price $${custom} (list ${list})${onInvoice}`;
  }
  if (included && enabled) return `Included in ${plan}`;
  if (included) return `Included in ${plan}. Turn the switch on to use it.`;
  if (def.billingType === "monthly") {
    return enabled ? `$${def.monthlyPrice} per month, on the monthly invoice` : `$${def.monthlyPrice} per month`;
  }
  return `$${def.oneTimePrice} one-time`;
}

function statusLabel(enabled: boolean, included: boolean): string {
  if (enabled && included) return "In the plan";
  if (enabled) return "On";
  if (included) return "In the plan, off";
  return "Off";
}

function ProductSwitch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-emerald-500" : "bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`}
      />
    </button>
  );
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
        const active = isAddonActiveForTenant(def, data.entitlements.plan, state);
        if (filter === "active") return active;
        return !active;
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
              className="overflow-visible rounded-lg border border-slate-800"
              style={{ borderTop: "2px solid var(--role-accent)" }}
            >
              <div
                className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm font-medium"
                style={{
                  color: "var(--role-text-accent)",
                  backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 65%, rgb(2 6 23))",
                }}
              >
                <span>{category}</span>
                <span className="text-xs font-normal text-slate-400">
                  {rows.filter((row) => {
                    const def = row.kind === "single" ? row.def : getAddonByKey(
                      activeTierKeyInFamily(
                        row.family,
                        row.variants,
                        entitlements.addons,
                        entitlements.plan,
                        isAddonIncludedInPlan,
                      ) || row.variants[0]!.key,
                    );
                    const state = entitlements.addons[def.key];
                    return isAddonActiveForTenant(def, entitlements.plan, state);
                  }).length}{" "}
                  on
                </span>
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
  const activeCount = visibleCatalog.filter((def) =>
    isAddonActiveForTenant(def, entitlements.plan, entitlements.addons[def.key]),
  ).length;
  const offCount = Math.max(visibleCatalog.length - activeCount, 0);
  const openInvoice = invoiceData?.invoice as Record<string, unknown> | null | undefined;
  const openInvoiceNumber = invoiceNumberFromRecord(openInvoice);
  const monthlyInvoiceAddons = entitledMonthlyInvoiceAddons(entitlements, new Date().toISOString());

  async function applyPatch(
    body: Parameters<typeof mutation.mutateAsync>[0],
    addonLabel: string,
    monthly: boolean,
  ) {
    try {
      const result = await mutation.mutateAsync(body);
      const delta = result.invoiceDelta as unknown as InvoiceLineItemDelta;
      const proRataCents = Number(delta?.proRataAdjustmentCents ?? 0);
      setBanner({
        proRataCents,
        invoiceNumber: openInvoiceNumber,
        addonLabel,
        monthly,
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
        `Turn on ${def.name}? It will be included on the automatic monthly invoice. A draft that has not been sent picks this up the next time invoices run. A sent invoice stays as it was.`,
      );
      if (!ok) return;
    }
    if (!enabled && def.billingType === "monthly") {
      const ok = window.confirm(
        `Turn off ${def.name}? It will come off the next automatic monthly invoice. A sent invoice stays as it was.`,
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
      def.billingType === "monthly",
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

    const newIsIncluded = isAddonIncludedInPlan(def, entitlements.plan);

    // Disable any enabled paid variant in the family (never PATCH a plan-included SKU).
    for (const v of variants) {
      const enabled = Boolean(entitlements.addons[v.key]?.enabled);
      if (!enabled) continue;
      if (isAddonIncludedInPlan(v, entitlements.plan)) continue;
      if (v.key === newKey) continue;
      await applyPatch(
        { addonKey: v.key, enabled: false, forceImmediateDisable: true },
        v.name,
        v.billingType === "monthly",
      );
    }

    // Selecting the plan-included base just clears paid upgrades — no enable PATCH.
    if (newIsIncluded) return;

    await applyPatch({ addonKey: newKey, enabled: true }, def.name, def.billingType === "monthly");
  }

  async function onOverrideBlur(def: AddonDefinition, raw: string) {
    if (!canEdit) return;
    const state = entitlements.addons[def.key];
    const trimmed = raw.trim();
    if (!trimmed) {
      if (state?.overridePriceCents) {
        await applyPatch(
          { addonKey: def.key, enabled: Boolean(state.enabled) },
          def.name,
          def.billingType === "monthly",
        );
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
      def.billingType === "monthly",
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
      const familyHasIncluded = row.variants.some((v) =>
        isAddonIncludedInPlan(v, entitlements.plan),
      );
      const state = activeKey ? entitlements.addons[activeKey] : entitlements.addons[row.variants[0]!.key];
      const displayDef = activeDef ?? row.variants[0]!;
      const enabled = isAddonActiveForTenant(displayDef, entitlements.plan, state);
      const displayIncluded = isAddonIncludedInPlan(displayDef, entitlements.plan);

      const productName = displayDef.name.replace(/\s+\w+$/, "");
      return (
        <li
          key={row.family}
          className={`grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
            enabled ? "bg-slate-950/40" : "bg-slate-950/10"
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-100">{productName}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  enabled ? "bg-emerald-900/60 text-emerald-200" : "bg-slate-800 text-slate-400"
                }`}
              >
                {statusLabel(enabled, displayIncluded)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{displayDef.description}</p>
            <p className="mt-2 text-sm text-slate-300">
              {priceText(displayDef, state, entitlements.plan, displayIncluded, enabled)}
            </p>
            {renderAvailabilityNote(displayDef)}
            {canEdit ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">Custom price</summary>
                <div className="mt-2">
                  <OverridePriceInput
                    def={displayDef}
                    stateCents={state?.overridePriceCents}
                    draft={overrideDrafts[displayDef.key]}
                    onDraftChange={(v) => setOverrideDrafts((d) => ({ ...d, [displayDef.key]: v }))}
                    onBlur={(v) => void onOverrideBlur(displayDef, v)}
                  />
                </div>
              </details>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              Level
              <select
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                value={activeKey || row.variants[0]!.key}
                disabled={!canEdit || mutation.isPending}
                title={
                  !canEdit
                    ? "You can review products. An RC admin changes them."
                    : familyHasIncluded
                      ? "The plan includes the base level. A higher level is billed."
                      : undefined
                }
                onChange={(e) => void onTierChange(row.variants, e.target.value as AddonKey)}
              >
                {row.variants.map((v) => {
                  const vIncluded = isAddonIncludedInPlan(v, entitlements.plan);
                  return (
                    <option key={v.key} value={v.key}>
                      {tierLabel(v.key)}
                      {vIncluded
                        ? " — in the plan"
                        : v.billingType === "monthly"
                          ? ` — $${v.monthlyPrice}/mo`
                          : ` — $${v.oneTimePrice}`}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <ProductSwitch
                on={enabled}
                disabled={!canEdit || mutation.isPending}
                label={`${productName}, ${enabled ? "on" : "off"}`}
                onChange={(next) => void onToggle(displayDef, next)}
              />
              <span className="w-8 text-sm text-slate-300">{enabled ? "On" : "Off"}</span>
            </div>
          </div>
        </li>
      );
    }

    const { def } = row;
    const state = entitlements.addons[def.key];
    const included = isAddonIncludedInPlan(def, entitlements.plan);
    const enabled = isAddonActiveForTenant(def, entitlements.plan, state);

    return (
      <li
        key={def.key}
        className={`grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
          enabled ? "bg-slate-950/40" : "bg-slate-950/10"
        }`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-100">{def.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                enabled ? "bg-emerald-900/60 text-emerald-200" : "bg-slate-800 text-slate-400"
              }`}
            >
              {statusLabel(enabled, included)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{def.description}</p>
          <p className="mt-2 text-sm text-slate-300">{priceText(def, state, entitlements.plan, included, enabled)}</p>
          {renderAvailabilityNote(def)}
          {canEdit ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500">Custom price</summary>
              <div className="mt-2">
                <OverridePriceInput
                  def={def}
                  stateCents={state?.overridePriceCents}
                  draft={overrideDrafts[def.key]}
                  onDraftChange={(v) => setOverrideDrafts((d) => ({ ...d, [def.key]: v }))}
                  onBlur={(v) => void onOverrideBlur(def, v)}
                />
              </div>
            </details>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ProductSwitch
            on={enabled}
            disabled={!canEdit || mutation.isPending}
            label={`${def.name}, ${enabled ? "on" : "off"}`}
            onChange={(next) => void onToggle(def, next)}
          />
          <span className="w-8 text-sm text-slate-300">{enabled ? "On" : "Off"}</span>
        </div>
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
        <span
          className="rounded-full px-3 py-1"
          style={{
            color: "var(--role-text-accent)",
            backgroundColor: "color-mix(in srgb, var(--role-accent-dim) 50%, rgb(2 6 23))",
          }}
        >
          Plan: {entitlements.plan}
        </span>
        <span className="text-slate-300">{activeCount} on</span>
        <span className="text-slate-500">{offCount} off</span>
        {manageAllAddons ? (
          <span className="text-xs text-slate-500">Showing every product, including other verticals.</span>
        ) : null}
      </div>

      {canEdit ? null : (
        <p className="rounded-md border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          You can review what {agencyName} has. An RC admin turns products on and off.
        </p>
      )}

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
            <strong>{banner.addonLabel}</strong>{" "}
            {banner.monthly
              ? "is updated for the automatic monthly invoice."
              : "updated."}{" "}
            {banner.proRataCents !== 0 ? (
              <>
                Mid-cycle adjustment{" "}
                <span className="font-mono">{formatUsd(banner.proRataCents)}</span>
                {banner.invoiceNumber || openInvoiceNumber ? (
                  <>
                    {" "}
                    on the open invoice{" "}
                    <span className="font-mono">#{banner.invoiceNumber || openInvoiceNumber}</span>
                  </>
                ) : null}
                .
              </>
            ) : null}
          </p>
          <Link
            href="/rc-admin/automated-invoices"
            className="mt-2 inline-block underline hover:opacity-90"
            style={{ color: "var(--role-accent)" }}
          >
            Monthly invoices →
          </Link>
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h2 className="text-sm font-semibold text-slate-200">On the automatic monthly invoice</h2>
        <p className="mt-1 text-xs text-slate-500">
          These products are billed each month. Products already in the plan are not charged again. A sent invoice
          stays as it was. A draft picks up the change the next time invoices run.
        </p>
        {monthlyInvoiceAddons.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No extra monthly products.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {monthlyInvoiceAddons.map((addon) => (
              <li key={addon.key} className="flex flex-wrap justify-between gap-2">
                <span>{addon.label}</span>
                <span className="text-slate-400">${(addon.monthlyFeeCents / 100).toFixed(2)}/mo</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/rc-admin/automated-invoices"
          className="mt-3 inline-block text-sm underline hover:opacity-90"
          style={{ color: "var(--role-accent)" }}
        >
          Open monthly invoices →
        </Link>
      </section>

      {Array.isArray(openInvoice?.addonLineItems) &&
      (openInvoice.addonLineItems as Array<Record<string, unknown>>).length > 0 ? (
        <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Mid-cycle adjustment{openInvoiceNumber ? ` #${openInvoiceNumber}` : ""}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            This is the open invoice for the rest of the current cycle. The monthly invoice is the list above.
          </p>
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
            {mode === "all" ? "All" : mode === "active" ? "On" : "Off"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {grouped.size === 0 ? (
          <p className="text-sm text-slate-400">Nothing in this view.</p>
        ) : null}
        {[...grouped.entries()].map(([category, rows]) => (
          <section
            key={category}
            className="overflow-visible rounded-lg border border-slate-800"
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

      <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">Change history</summary>
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
      </details>
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
    <div className="flex flex-col items-start gap-1">
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
