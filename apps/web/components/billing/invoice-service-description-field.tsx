"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CatalogItem, ServiceCategory } from "rapid-cortex-shared";

const CATEGORY_ORDER: ServiceCategory[] = [
  "core",
  "addon",
  "professional",
  "support",
  "rc_lite",
  "vertical",
];

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  core: "Core / Plans",
  addon: "Add-ons",
  professional: "Professional services",
  support: "Support",
  rc_lite: "RC Lite",
  vertical: "Verticals",
};

export type InvoiceCatalogPick = {
  name: string;
  unitPriceDollars: number | null;
};

type Props = {
  value: string;
  catalog: CatalogItem[];
  catalogLoading?: boolean;
  onChange: (description: string) => void;
  /** When a catalog row is chosen, also apply its list price (dollars). */
  onPick?: (pick: InvoiceCatalogPick) => void;
  placeholder?: string;
};

function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}

function listPriceDollars(item: CatalogItem): number | null {
  if (item.priceType === "included") return 0;
  if (item.priceType === "custom") return null;
  if (item.priceType === "range") {
    return centsToDollars(item.priceMin ?? item.unitPrice);
  }
  return centsToDollars(item.unitPrice);
}

function formatListPrice(item: CatalogItem): string {
  if (item.priceType === "included") return "Included";
  if (item.priceType === "custom") return "Custom";
  if (item.priceType === "range") {
    const lo = centsToDollars(item.priceMin);
    const hi = centsToDollars(item.priceMax);
    if (lo == null || hi == null) return "Range";
    return `${lo.toLocaleString("en-US", { style: "currency", currency: "USD" })}–${hi.toLocaleString("en-US", { style: "currency", currency: "USD" })}`;
  }
  const d = centsToDollars(item.unitPrice);
  if (d == null) return "—";
  return d.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Combobox for invoice line descriptions: searchable Pricing Menu / Service Catalog items,
 * grouped by category. Free-text custom descriptions remain allowed.
 */
export function InvoiceServiceDescriptionField({
  value,
  catalog,
  catalogLoading,
  onChange,
  onPick,
  placeholder = "Search services or type a custom name…",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const enabled = catalog.filter((x) => x.enabled);
    if (!q) return enabled;
    return enabled.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.subcategory ?? "").toLowerCase().includes(q),
    );
  }, [catalog, value]);

  const grouped = useMemo(() => {
    const map = new Map<ServiceCategory, CatalogItem[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const item of filtered) {
      const list = map.get(item.category as ServiceCategory);
      if (list) list.push(item);
      else {
        const other = map.get("addon") ?? [];
        other.push(item);
        map.set("addon", other);
      }
    }
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: CATEGORY_LABEL[cat],
      items: (map.get(cat) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function selectItem(item: CatalogItem) {
    onChange(item.name);
    onPick?.({ name: item.name, unitPriceDollars: listPriceDollars(item) });
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(flat.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter" && flat[highlight]) {
      e.preventDefault();
      selectItem(flat[highlight]);
    }
  }

  let flatIndex = -1;

  return (
    <div ref={rootRef} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
        autoComplete="off"
      />
      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl"
        >
          {catalogLoading ? (
            <p className="px-3 py-2 text-[11px] text-slate-500">Loading pricing catalog…</p>
          ) : null}
          {!catalogLoading && flat.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-500">
              No catalog matches — keep typing for a custom line item.
            </p>
          ) : null}
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="sticky top-0 border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                {group.label}
              </div>
              {group.items.map((item) => {
                flatIndex += 1;
                const idx = flatIndex;
                const active = idx === highlight;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlight(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectItem(item);
                    }}
                    className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-xs ${
                      active ? "bg-violet-950/50 text-slate-100" : "text-slate-300 hover:bg-slate-900"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-100">{item.name}</span>
                      {item.description ? (
                        <span className="mt-0.5 line-clamp-1 block text-[10px] text-slate-500">
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] text-sky-300">
                      {formatListPrice(item)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
