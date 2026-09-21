"use client";

import { useClockPreference } from "@/components/providers/clock-preference-provider";
import type { ClockFormat } from "@/lib/clock-format";

const OPTIONS: readonly { id: ClockFormat; label: string }[] = [
  { id: "12", label: "12h" },
  { id: "24", label: "24h" },
];

export function ClockFormatPicker() {
  const { clockFormat, setClockFormat } = useClockPreference();

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Clock format">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-[color:var(--rc-text-muted)] sm:inline">
        Clock
      </span>
      {OPTIONS.map((option) => {
        const selected = clockFormat === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => setClockFormat(option.id)}
            title={option.id === "12" ? "12-hour clock" : "24-hour clock"}
            className={
              selected
                ? "min-w-[2.4rem] rounded border border-[color:var(--role-accent,#0ea5e9)] bg-[color:var(--rc-surface)] px-1.5 py-1 text-[11px] font-semibold tabular-nums text-[color:var(--rc-text-primary)] outline-none"
                : "min-w-[2.4rem] rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] px-1.5 py-1 text-[11px] font-medium tabular-nums text-[color:var(--rc-text-secondary)] outline-none transition hover:border-[color:var(--rc-border-hover)] hover:text-[color:var(--rc-text-primary)]"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
