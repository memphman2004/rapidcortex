"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItem, ServiceCategory } from "rapid-cortex-shared";

const CATEGORY_META: Record<string, { title: string; emoji: string }> = {
  core: { title: "Core Services", emoji: "🚀" },
  addon: { title: "Add-On Services", emoji: "⚡" },
  professional: { title: "Professional Services", emoji: "🛠️" },
  support: { title: "Support Plans", emoji: "💬" },
  rc_lite: { title: "RC Lite API", emoji: "🔌" },
  vertical: { title: "Vertical Packages", emoji: "🏢" },
};

const BILLING_LABEL: Record<string, string> = {
  monthly: "/month",
  annual: "/year",
  one_time: " one-time",
  included: " included",
};

type SelectedLineItem = {
  id: string;
  itemId: string;
  name: string;
  description?: string;
  quantity: number;
  unitPriceCents: number;
};

function asMoney(cents: number | null): string {
  if (cents === null) return "Custom";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function ServiceCatalogDashboard() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | ServiceCategory>("all");
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedLineItem[]>([]);
  const [customDesc, setCustomDesc] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customPriceCents, setCustomPriceCents] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/rc-admin/pricing/catalog");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: CatalogItem[]; updatedAt?: string };
        setItems((data.items ?? []).filter((x) => x.enabled));
        if (data.updatedAt) setCatalogUpdatedAt(data.updatedAt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load catalog");
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const counts = useMemo(() => {
    const c = { core: 0, addon: 0, professional: 0, support: 0, rc_lite: 0, vertical: 0 };
    for (const item of items) {
      if (item.category in c) c[item.category as keyof typeof c]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, search, items]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, CatalogItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [filtered]);

  const subtotalCents = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
    [selectedItems],
  );

  function exportCsv() {
    const headers = ["ID", "Name", "Description", "Category", "Subcategory", "Unit Price (cents)", "Billing Period"];
    const rows = items.map((s) => [
      s.id,
      s.name,
      s.description,
      s.category,
      s.subcategory,
      String(s.unitPrice ?? ""),
      s.billingPeriod,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rapid-cortex-pricing-catalog.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleItem(item: CatalogItem) {
    setSelectedItems((prev) => {
      const existing = prev.find((x) => x.itemId === item.id);
      if (existing) return prev.filter((x) => x.itemId !== item.id);
      return [
        ...prev,
        {
          id: `selected-${item.id}`,
          itemId: item.id,
          name: item.name,
          description: item.description,
          quantity: 1,
          unitPriceCents: item.unitPrice ?? 0,
        },
      ];
    });
  }

  function updateSelected(id: string, patch: Partial<SelectedLineItem>) {
    setSelectedItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function addCustomLineItem() {
    if (!customDesc.trim() || customQty <= 0 || customPriceCents < 0) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        id: `custom-${crypto.randomUUID()}`,
        itemId: "",
        name: customDesc.trim(),
        description: "Custom line item",
        quantity: customQty,
        unitPriceCents: customPriceCents,
      },
    ]);
    setCustomDesc("");
    setCustomQty(1);
    setCustomPriceCents(0);
  }

  const categories: ("all" | ServiceCategory)[] = [
    "all",
    "core",
    "addon",
    "professional",
    "support",
    "rc_lite",
    "vertical",
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-r from-[#2E5090] to-[#1a3a6b] p-6">
        <h1 className="text-2xl font-semibold text-white">Rapid Cortex Pricing Catalog</h1>
        <p className="mt-1 text-sm text-slate-200">
          Live pricing data — internal billing dashboard and invoice service selector.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <StatCard label="Core" value={counts.core} />
        <StatCard label="Add-Ons" value={counts.addon} />
        <StatCard label="Prof. Services" value={counts.professional} />
        <StatCard label="Support" value={counts.support} />
        <StatCard label="RC Lite" value={counts.rc_lite} />
        <StatCard label="Verticals" value={counts.vertical} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog..."
          className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                category === c
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {c === "all" ? "All" : c.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="rounded-lg border border-emerald-600 bg-emerald-700/20 px-3 py-1.5 text-xs font-semibold text-emerald-200"
        >
          Export CSV
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-700 bg-rose-900/20 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {isLoading ? <div className="text-sm text-slate-400">Loading pricing catalog...</div> : null}
          {!isLoading &&
            Object.entries(grouped).map(([cat, rows]) => {
              const meta = CATEGORY_META[cat] ?? { title: cat, emoji: "🧩" };
              return (
                <section key={cat} className="space-y-3">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
                    <span className="text-2xl">{meta.emoji}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">{meta.title}</h2>
                      <p className="text-xs text-slate-400">{rows.length} items</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {rows.map((item) => {
                      const selected = selectedItems.some((x) => x.itemId === item.id);
                      const billingLabel =
                        BILLING_LABEL[item.billingPeriod] ??
                        (item.billingPeriod ? `/${item.billingPeriod}` : "");
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(item)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-sky-500 bg-sky-950/30"
                              : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                              {item.subcategory ? (
                                <p className="mt-1 text-xs text-slate-500">{item.subcategory}</p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              {item.priceType === "custom" ? (
                                <span className="text-sm font-semibold text-amber-300">Custom</span>
                              ) : item.priceType === "included" ? (
                                <span className="text-sm font-semibold text-emerald-300">Included</span>
                              ) : item.priceType === "range" ? (
                                <span className="text-sm font-semibold text-sky-200">
                                  {asMoney(item.priceMin)}–{asMoney(item.priceMax)}
                                </span>
                              ) : (
                                <span className="text-sm font-semibold text-sky-200">
                                  {asMoney(item.unitPrice)}
                                  <span className="text-xs font-normal text-slate-400">{billingLabel}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>

        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-base font-semibold text-slate-100">Selected Services (Editable)</h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-slate-400">Select items on the left to build an invoice.</p>
          ) : null}

          {selectedItems.map((item) => {
            const lineTotal = item.quantity * item.unitPriceCents;
            return (
              <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.name}</p>
                    {!item.itemId ? <p className="text-xs text-amber-300">Custom line item</p> : null}
                  </div>
                  <button
                    onClick={() => setSelectedItems((prev) => prev.filter((x) => x.id !== item.id))}
                    className="text-xs text-rose-300 hover:text-rose-200"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-xs text-slate-400">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateSelected(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Unit Price (cents)
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={item.unitPriceCents}
                      onChange={(e) =>
                        updateSelected(item.id, {
                          unitPriceCents: Math.max(0, Math.round(Number(e.target.value) || 0)),
                        })
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                    />
                  </label>
                  <div className="text-xs text-slate-400">
                    Line Total
                    <div className="mt-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm font-semibold text-sky-200">
                      {asMoney(lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
            <p className="text-sm font-semibold text-slate-100">Add Custom Line Item</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Description"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
              <input
                type="number"
                min={1}
                value={customQty}
                onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value) || 1))}
                placeholder="Qty"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={customPriceCents}
                onChange={(e) =>
                  setCustomPriceCents(Math.max(0, Math.round(Number(e.target.value) || 0)))
                }
                placeholder="Cents"
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
            </div>
            <button
              onClick={addCustomLineItem}
              className="mt-2 rounded-md border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Add Custom Item
            </button>
          </div>

          <div className="border-t border-slate-700 pt-3">
            <div className="flex items-end justify-between gap-2">
              {catalogUpdatedAt ? (
                <p className="text-xs text-slate-500">
                  Prices as of{" "}
                  {new Date(catalogUpdatedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "short",
                  })}
                </p>
              ) : (
                <span />
              )}
              <p className="text-sm text-slate-300">
                Subtotal: <span className="font-semibold text-sky-200">{asMoney(subtotalCents)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{props.value}</p>
    </div>
  );
}
