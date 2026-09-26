"use client";

import { useMemo, useState } from "react";
import {
  SALES_FEATURE_CATALOG,
  type SalesFeatureCatalogItem,
  type SalesFeatureVertical,
} from "rapid-cortex-shared";

const VERTICAL_LABELS: Record<SalesFeatureVertical, string> = {
  all: "All verticals",
  rc911: "911 / PSAP",
  campus: "Campus",
  venue: "Venue",
  hospital: "Hospital",
  transit: "Transit",
};

const FILTERS: SalesFeatureVertical[] = ["all", "rc911", "campus", "venue", "hospital", "transit"];

function matchesVertical(item: SalesFeatureCatalogItem, filter: SalesFeatureVertical): boolean {
  if (filter === "all") return true;
  return item.compatibleVerticals.includes("all") || item.compatibleVerticals.includes(filter);
}

export function SalesPricingCatalogClient() {
  const [filter, setFilter] = useState<SalesFeatureVertical>("all");
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = SALES_FEATURE_CATALOG.filter((item) => {
      if (!matchesVertical(item, filter)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
    return rows.reduce<Record<string, SalesFeatureCatalogItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [filter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Pricing Catalog</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Features by vertical for sales conversations. No list prices — use Quote Builder for
          proposal math.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search features…"
          className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                filter === v
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-slate-700 bg-slate-900 text-slate-300"
              }`}
            >
              {VERTICAL_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="space-y-3">
            <h2 className="border-b border-slate-800 pb-2 text-lg font-semibold text-slate-100">
              {category}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        item.isFree
                          ? "bg-emerald-950 text-emerald-300"
                          : item.neverFree
                            ? "bg-rose-950 text-rose-300"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {item.isFree ? (item.freeKind === "one_time_service" ? "Free service" : "Free") : item.neverFree ? "Never free" : "Paid"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.explanation}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-500">
                    {item.compatibleVerticals.map((v) => VERTICAL_LABELS[v]).join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-slate-500">No features match this filter.</p>
        ) : null}
      </div>
    </div>
  );
}
