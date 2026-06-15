"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ADDON_CATALOG, type AddonDefinition } from "rapid-cortex-shared";
import { AgencyBillingSubnav } from "@/components/billing/agency-billing-subnav";
import { CreateAgencyInvoiceModal } from "@/components/billing/create-agency-invoice-modal";
import type { AgencyBillingSummary, UiLineItem } from "@/lib/rc-admin/agency-invoice-view";
import type { FeatureAddOnRow } from "@/lib/rc-admin/feature-add-on-types";

type Props = {
  agencyId: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function catalogPrice(def: AddonDefinition): number {
  return def.billingType === "one_time" ? def.oneTimePrice : def.monthlyPrice;
}

function catalogToRow(def: AddonDefinition): FeatureAddOnRow {
  return {
    id: def.key,
    name: def.name,
    category: def.category,
    description: def.description,
    unitPrice: catalogPrice(def),
    billingCycle: def.billingType === "one_time" ? "one_time" : "monthly",
    status: "disabled",
    serviceCode: def.key,
  };
}

function AddFeatureModal({
  enabledIds,
  onAdd,
  onClose,
}: {
  enabledIds: Set<string>;
  onAdd: (feature: FeatureAddOnRow) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = useMemo(
    () => [...new Set(ADDON_CATALOG.map((f) => f.category))],
    [],
  );

  const available = ADDON_CATALOG.filter((def) => {
    if (enabledIds.has(def.key)) return false;
    if (
      search &&
      !def.name.toLowerCase().includes(search.toLowerCase()) &&
      !def.description.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (selectedCategory !== "All" && def.category !== selectedCategory) return false;
    return true;
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1221]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-100">Add feature add-on</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="flex gap-2 border-b border-white/10 px-6 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search features…"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            autoFocus
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-44 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
          >
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {available.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No features match your search.</p>
          ) : (
            categories
              .filter((c) => selectedCategory === "All" || c === selectedCategory)
              .map((cat) => {
                const items = available.filter((f) => f.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-4">
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {cat}
                    </p>
                    {items.map((def) => (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() =>
                          onAdd({
                            ...catalogToRow(def),
                            status: "enabled",
                            enabledAt: new Date().toISOString(),
                            enabledBy: "rcsuperadmin",
                          })
                        }
                        className="mb-1 flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-200">{def.name}</p>
                          <p className="text-xs text-slate-500">{def.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-violet-300">
                            {formatCurrency(catalogPrice(def))}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {def.billingType === "one_time" ? "one-time" : "/month"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-emerald-400">+ Add</span>
                      </button>
                    ))}
                  </div>
                );
              })
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgencyFeatureAddonsClient({ agencyId }: Props) {
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureAddOnRow[]>([]);
  const [agency, setAgency] = useState<AgencyBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedForInvoice, setSelectedForInvoice] = useState<Set<string>>(new Set());
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<FeatureAddOnRow[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [addOnsRes, agencyRes] = await Promise.all([
          fetch(`/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/add-ons`),
          fetch(`/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing-summary`),
        ]);
        if (addOnsRes.ok) setEnabledFeatures((await addOnsRes.json()) as FeatureAddOnRow[]);
        if (agencyRes.ok) setAgency((await agencyRes.json()) as AgencyBillingSummary);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [agencyId]);

  const enabledIds = new Set([...enabledFeatures, ...pendingChanges].map((f) => f.id));
  const allFeatures = [...enabledFeatures, ...pendingChanges];
  const forInvoice = allFeatures.filter((f) => selectedForInvoice.has(f.id));
  const invoiceTotal = forInvoice.reduce((s, f) => s + f.unitPrice, 0);
  const hasPending = pendingChanges.length > 0;

  const groupedByCategory = useMemo(() => {
    const map: Record<string, FeatureAddOnRow[]> = {};
    for (const f of allFeatures) {
      map[f.category] ??= [];
      map[f.category].push(f);
    }
    return map;
  }, [allFeatures]);

  function handleAddFeature(feature: FeatureAddOnRow) {
    setPendingChanges((prev) => (prev.find((f) => f.id === feature.id) ? prev : [...prev, feature]));
    setSelectedForInvoice((prev) => new Set([...prev, feature.id]));
  }

  async function handleSaveChanges() {
    const res = await fetch(`/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/add-ons`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: pendingChanges.map((f) => f.serviceCode) }),
    });
    if (res.ok) {
      setEnabledFeatures((prev) => [...prev, ...pendingChanges]);
      setPendingChanges([]);
    }
  }

  async function handleDisable(feature: FeatureAddOnRow) {
    if (!window.confirm(`Disable "${feature.name}" for ${agency?.agencyName ?? agencyId}?`)) return;
    const res = await fetch(
      `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/add-ons/${encodeURIComponent(feature.serviceCode)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setEnabledFeatures((prev) => prev.filter((f) => f.id !== feature.id));
      setSelectedForInvoice((prev) => {
        const next = new Set(prev);
        next.delete(feature.id);
        return next;
      });
    }
  }

  const prefillLineItems: UiLineItem[] = forInvoice.map((f) => ({
    id: f.id,
    description: `${f.name}${f.billingCycle === "monthly" ? " (monthly)" : " (one-time)"}`,
    quantity: 1,
    unitPrice: f.unitPrice,
    total: f.unitPrice,
  }));

  return (
    <div className="space-y-6 pb-24">
      <AgencyBillingSubnav agencyId={agencyId} active="feature-add-ons" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Feature add-ons — {agency?.agencyName ?? agencyId}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage active feature subscriptions. Select add-ons to include in an amendment invoice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPending ? (
            <button
              type="button"
              onClick={() => void handleSaveChanges()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300"
            >
              Save changes ({pendingChanges.length})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300"
          >
            + Add feature
          </button>
          <button
            type="button"
            onClick={() => setShowAmendmentModal(true)}
            disabled={selectedForInvoice.size === 0}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create invoice
            {selectedForInvoice.size > 0 ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                {selectedForInvoice.size} · {formatCurrency(invoiceTotal)}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {invoiceCreated ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          <span>Invoice created successfully.</span>
          <div className="flex items-center gap-3">
            <Link
              href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing`}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              View in billing hub →
            </Link>
            <button type="button" onClick={() => setInvoiceCreated(false)} className="text-slate-500">
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {allFeatures.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Select add-ons to include in an invoice:</span>
          <button
            type="button"
            onClick={() => setSelectedForInvoice(new Set(allFeatures.map((f) => f.id)))}
            className="rounded border border-white/10 px-2 py-1"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelectedForInvoice(new Set())}
            className="rounded border border-white/10 px-2 py-1"
          >
            Clear
          </button>
        </div>
      ) : null}

      {hasPending ? (
        <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          {pendingChanges.length} unsaved add-on{pendingChanges.length > 1 ? "s" : ""} pending. Save
          changes to activate them for this agency, then create an invoice.
        </div>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading add-ons…</p>
      ) : allFeatures.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">
          No add-ons enabled for this agency.{" "}
          <button type="button" onClick={() => setShowAdd(true)} className="text-sky-400 hover:text-sky-300">
            Add the first one →
          </button>
        </p>
      ) : (
        Object.entries(groupedByCategory).map(([category, features]) => (
          <div key={category}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              {category}
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-wide text-slate-600">
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2">Feature</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2">Billing</th>
                    <th className="px-3 py-2">Enabled</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature) => {
                    const isPending = pendingChanges.some((f) => f.id === feature.id);
                    const isSelected = selectedForInvoice.has(feature.id);
                    return (
                      <tr
                        key={feature.id}
                        className={`border-b border-white/5 ${isSelected ? "bg-violet-900/10" : ""}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedForInvoice((prev) => {
                                const next = new Set(prev);
                                if (next.has(feature.id)) next.delete(feature.id);
                                else next.add(feature.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-200">{feature.name}</p>
                          <p className="font-mono text-[10px] text-slate-600">{feature.serviceCode}</p>
                        </td>
                        <td className="max-w-xs px-3 py-2 text-xs text-slate-400">{feature.description}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-violet-300">
                          {formatCurrency(feature.unitPrice)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                            {feature.billingCycle === "monthly" ? "Monthly" : "One-time"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {feature.enabledAt ? formatDate(feature.enabledAt) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {isPending ? (
                            <span className="rounded bg-amber-900/30 px-2 py-0.5 text-[10px] text-amber-300">
                              Pending save
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-[10px] text-emerald-300">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingChanges((prev) => prev.filter((f) => f.id !== feature.id));
                                setSelectedForInvoice((prev) => {
                                  const next = new Set(prev);
                                  next.delete(feature.id);
                                  return next;
                                });
                              }}
                              className="rounded border border-rose-900/40 px-2 py-1 text-[11px] text-rose-400"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleDisable(feature)}
                              className="rounded border border-rose-900/40 px-2 py-1 text-[11px] text-rose-400"
                            >
                              Disable
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {selectedForInvoice.size > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-white/10 bg-[#0d0f1e] px-8 py-3">
          <p className="text-sm text-slate-400">
            {selectedForInvoice.size} add-on{selectedForInvoice.size > 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-5">
            <p className="text-sm text-slate-200">
              Monthly total:{" "}
              <span className="font-bold tabular-nums text-violet-300">{formatCurrency(invoiceTotal)}</span>
            </p>
            <button
              type="button"
              onClick={() => setShowAmendmentModal(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
            >
              Create invoice for selected →
            </button>
          </div>
        </div>
      ) : null}

      {showAdd ? (
        <AddFeatureModal
          enabledIds={enabledIds}
          onAdd={handleAddFeature}
          onClose={() => setShowAdd(false)}
        />
      ) : null}

      {showAmendmentModal && agency ? (
        <CreateAgencyInvoiceModal
          agencyId={agencyId}
          agency={agency}
          prefillItems={prefillLineItems}
          onClose={() => setShowAmendmentModal(false)}
          onCreated={() => {
            setShowAmendmentModal(false);
            setInvoiceCreated(true);
            setSelectedForInvoice(new Set());
            if (hasPending) void handleSaveChanges();
          }}
        />
      ) : null}
    </div>
  );
}
