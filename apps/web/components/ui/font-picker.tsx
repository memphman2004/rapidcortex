"use client";

import {
  useFontPreference,
  type PreferredDashboardFont,
} from "@/components/providers/font-preference-provider";

function btnClass(active: boolean): string {
  return [
    "rounded border px-2 py-1 text-[11px] font-medium transition-colors",
    active
      ? "border-[color:var(--role-accent,#0ea5e9)] bg-[color-mix(in_srgb,var(--role-accent,#0ea5e9)_18%,transparent)] text-white"
      : "border-slate-600 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white",
  ].join(" ");
}

export function FontPicker() {
  const { font, setFont } = useFontPreference();

  const items: { id: PreferredDashboardFont; label: string }[] = [
    { id: "courier", label: "Courier" },
    { id: "inter", label: "Inter" },
    { id: "times", label: "Times New Roman" },
    { id: "arial", label: "Arial" },
  ];

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Dashboard font">
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={btnClass(font === id)}
          onClick={() => setFont(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
