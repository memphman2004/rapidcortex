"use client";

import {
  PREFERRED_DASHBOARD_FONTS,
  PREFERRED_DASHBOARD_FONT_LABELS,
  useFontPreference,
  type PreferredDashboardFont,
} from "@/components/providers/font-preference-provider";

export function FontPicker() {
  const { font, setFont } = useFontPreference();

  return (
    <label className="inline-flex items-center gap-1.5" aria-label="Dashboard font">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">
        Font
      </span>
      <select
        value={font}
        onChange={(e) => setFont(e.target.value as PreferredDashboardFont)}
        className="max-w-[9.5rem] rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-[11px] font-medium text-slate-200 outline-none transition hover:border-slate-500 focus:border-[color:var(--role-accent,#0ea5e9)]"
      >
        {PREFERRED_DASHBOARD_FONTS.map((id) => (
          <option key={id} value={id}>
            {PREFERRED_DASHBOARD_FONT_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
