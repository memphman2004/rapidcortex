"use client";

import { CAMPUS_SITE_SCOPE_ALL, type CampusSite } from "rapid-cortex-shared";

export function CampusSiteSwitcher({
  sites,
  value,
  onChange,
  variant = "page",
}: {
  sites: CampusSite[];
  value: string;
  onChange: (next: string) => void;
  variant?: "page" | "console";
}) {
  if (sites.length <= 1) return null;

  const isConsole = variant === "console";

  return (
    <label
      className={
        isConsole
          ? undefined
          : "block text-[10px] font-semibold uppercase tracking-widest text-slate-400"
      }
      style={
        isConsole
          ? { display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }
          : undefined
      }
    >
      <span style={isConsole ? { fontSize: 10, color: "#94a3b8", fontWeight: 600 } : undefined}>
        Campus
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Campus filter"
        className={
          isConsole
            ? undefined
            : "mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
        }
        style={
          isConsole
            ? {
                background: "#0f172a",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
              }
            : undefined
        }
      >
        <option value={CAMPUS_SITE_SCOPE_ALL}>All campuses</option>
        {sites.map((site) => (
          <option key={site.code} value={site.code}>
            {site.name}
            {site.city ? ` · ${site.city}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
