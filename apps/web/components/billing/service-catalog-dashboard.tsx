"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetchBillingServices, type BillingServiceCatalogRow } from "@/lib/api";

type ServiceCategory =
  | "CORE"
  | "ADD_ON"
  | "PROFESSIONAL_SERVICES"
  | "SUPPORT"
  | "USAGE"
  | "RC_LITE";

type BillingType = "ONE_TIME" | "MONTHLY" | "ANNUAL" | "USAGE";

type ServiceRow = BillingServiceCatalogRow & {
  category: ServiceCategory;
  billingType: BillingType;
};

type SelectedLineItem = {
  id: string;
  serviceId?: string;
  serviceName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  isCustom?: boolean;
};

const CATEGORY_META: Record<ServiceCategory, { title: string; emoji: string }> = {
  CORE: { title: "Core Services", emoji: "🚀" },
  ADD_ON: { title: "Add-On Services", emoji: "⚡" },
  PROFESSIONAL_SERVICES: { title: "Professional Services", emoji: "🛠️" },
  SUPPORT: { title: "Support Plans", emoji: "💬" },
  USAGE: { title: "Usage & Overages", emoji: "📊" },
  RC_LITE: { title: "RC Lite API", emoji: "🔌" },
};

function asMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function billingPeriod(type: BillingType): string {
  if (type === "MONTHLY") return "/month";
  if (type === "ANNUAL") return "/year";
  if (type === "USAGE") return "/usage";
  return "";
}

export function ServiceCatalogDashboard() {
  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"ALL" | ServiceCategory>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedLineItem[]>([]);
  const [customDesc, setCustomDesc] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customPrice, setCustomPrice] = useState(0);

  useEffect(() => {
    async function loadServices() {
      try {
        setIsLoading(true);
        const data = await fetchBillingServices({ active: true });
        setServices(
          (data.items ?? []).filter((x) => x.active) as ServiceRow[],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load services");
      } finally {
        setIsLoading(false);
      }
    }
    void loadServices();
  }, []);

  const counts = useMemo(() => {
    return {
      CORE: services.filter((s) => s.category === "CORE").length,
      ADD_ON: services.filter((s) => s.category === "ADD_ON").length,
      PROFESSIONAL_SERVICES: services.filter((s) => s.category === "PROFESSIONAL_SERVICES").length,
      SUPPORT: services.filter((s) => s.category === "SUPPORT").length,
    };
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((service) => {
      const matchesCategory = category === "ALL" || service.category === category;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        service.name.toLowerCase().includes(q) ||
        (service.description ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, search, services]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, ServiceRow[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [filtered]);

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [selectedItems],
  );

  function exportCsv() {
    const headers = ["Service ID", "Name", "Description", "Category", "Default Price", "Billing Type"];
    const rows = services.map((s) => [
      s.serviceId,
      s.name,
      s.description ?? "",
      s.category,
      String(s.defaultPrice),
      s.billingType,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rapid-cortex-service-catalog.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSeedFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ServiceRow[];
      if (!Array.isArray(parsed)) throw new Error("Seed JSON must be an array");
      const valid = parsed.filter((row) => typeof row?.serviceId === "string" && typeof row?.name === "string");
      setServices(valid);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid seed JSON");
    } finally {
      event.target.value = "";
    }
  }

  function toggleService(service: ServiceRow) {
    setSelectedItems((prev) => {
      const existing = prev.find((x) => x.serviceId === service.serviceId);
      if (existing) return prev.filter((x) => x.serviceId !== service.serviceId);
      return [
        ...prev,
        {
          id: `selected-${service.serviceId}`,
          serviceId: service.serviceId,
          serviceName: service.name,
          description: service.description,
          quantity: 1,
          unitPrice: service.defaultPrice,
        },
      ];
    });
  }

  function updateSelectedItem(id: string, patch: Partial<SelectedLineItem>) {
    setSelectedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addCustomLineItem() {
    if (!customDesc.trim() || customQty <= 0 || customPrice < 0) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        id: `custom-${crypto.randomUUID()}`,
        serviceName: customDesc.trim(),
        description: "Custom line item",
        quantity: customQty,
        unitPrice: customPrice,
        isCustom: true,
      },
    ]);
    setCustomDesc("");
    setCustomQty(1);
    setCustomPrice(0);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-r from-[#2E5090] to-[#1a3a6b] p-6">
        <h1 className="text-2xl font-semibold text-white">Rapid Cortex Service Catalog</h1>
        <p className="mt-1 text-sm text-slate-200">Internal billing pricing dashboard and invoice service selector.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Core Services" value={counts.CORE} />
        <StatCard label="Add-Ons" value={counts.ADD_ON} />
        <StatCard label="Prof. Services" value={counts.PROFESSIONAL_SERVICES} />
        <StatCard label="Support Plans" value={counts.SUPPORT} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap gap-2">
          {(["ALL", "CORE", "ADD_ON", "PROFESSIONAL_SERVICES", "SUPPORT", "RC_LITE"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                category === c
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {c === "ALL" ? "All Services" : c.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="rounded-lg border border-emerald-600 bg-emerald-700/20 px-3 py-1.5 text-xs font-semibold text-emerald-200"
        >
          Export CSV
        </button>
        <button
          onClick={() => seedInputRef.current?.click()}
          className="rounded-lg border border-indigo-600 bg-indigo-700/20 px-3 py-1.5 text-xs font-semibold text-indigo-200"
        >
          Load Seed JSON
        </button>
        <input
          ref={seedInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleSeedFilePick}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-700 bg-rose-900/20 p-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          {isLoading ? <div className="text-sm text-slate-400">Loading service catalog...</div> : null}
          {!isLoading &&
            Object.entries(grouped).map(([cat, rows]) => {
              const meta = CATEGORY_META[cat as ServiceCategory];
              return (
                <section key={cat} className="space-y-3">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
                    <span className="text-2xl">{meta?.emoji ?? "🧩"}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100">{meta?.title ?? cat}</h2>
                      <p className="text-xs text-slate-400">{rows.length} services</p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {rows.map((service) => {
                      const selected = selectedItems.some((x) => x.serviceId === service.serviceId);
                      return (
                        <button
                          key={service.serviceId}
                          onClick={() => toggleService(service)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-sky-500 bg-sky-950/30"
                              : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">{service.name}</p>
                              <p className="mt-1 text-xs text-slate-400">{service.description ?? "No description"}</p>
                            </div>
                            <span className="text-sm font-semibold text-sky-200">
                              {asMoney(service.defaultPrice)}
                              <span className="text-xs font-normal text-slate-400">{billingPeriod(service.billingType)}</span>
                            </span>
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
            <p className="text-sm text-slate-400">Select services on the left to auto-fill pricing and quantities.</p>
          ) : null}

          {selectedItems.map((item) => {
            const lineTotal = item.quantity * item.unitPrice;
            return (
              <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.serviceName}</p>
                    {item.isCustom ? <p className="text-xs text-amber-300">Custom line item</p> : null}
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
                        updateSelectedItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Unit Price
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateSelectedItem(item.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
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
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(Math.max(0, Number(e.target.value) || 0))}
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

          <div className="border-t border-slate-700 pt-3 text-right">
            <p className="text-sm text-slate-300">
              Subtotal: <span className="font-semibold text-sky-200">{asMoney(subtotal)}</span>
            </p>
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
