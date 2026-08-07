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
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-[color:var(--rc-text-muted)] sm:inline">
        Font
      </span>
      <select
        value={font}
        onChange={(e) => setFont(e.target.value as PreferredDashboardFont)}
        className="max-w-[9.5rem] rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] px-2 py-1 text-[11px] font-medium text-[color:var(--rc-text-primary)] outline-none transition hover:border-[color:var(--rc-border-hover)] focus:border-[color:var(--role-accent,#0ea5e9)]"
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
