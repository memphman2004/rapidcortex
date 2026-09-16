"use client";

import { useTypographyPreference } from "@/components/providers/typography-preference-provider";

export function FontSizePicker() {
  const { fontScale, canDecreaseFont, canIncreaseFont, decreaseFont, increaseFont, resetFontScale } =
    useTypographyPreference();
  const percent = Math.round(fontScale * 100);

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label="Dashboard text size">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-[color:var(--rc-text-muted)] sm:inline">
        Size
      </span>
      <button
        type="button"
        onClick={decreaseFont}
        disabled={!canDecreaseFont}
        aria-label="Decrease text size"
        title="Decrease text size"
        className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] text-[11px] font-semibold text-[color:var(--rc-text-primary)] transition hover:border-[color:var(--rc-border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        A−
      </button>
      <button
        type="button"
        onClick={resetFontScale}
        aria-label={`Text size ${percent} percent. Click to reset.`}
        title="Reset text size"
        className="min-w-[2.4rem] rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] px-1.5 py-1 text-[11px] font-medium tabular-nums text-[color:var(--rc-text-secondary)] outline-none transition hover:border-[color:var(--rc-border-hover)] hover:text-[color:var(--rc-text-primary)]"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={increaseFont}
        disabled={!canIncreaseFont}
        aria-label="Increase text size"
        title="Increase text size"
        className="flex h-7 w-7 items-center justify-center rounded border border-[color:var(--rc-border)] bg-[color:var(--rc-surface)] text-[13px] font-semibold text-[color:var(--rc-text-primary)] transition hover:border-[color:var(--rc-border-hover)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        A+
      </button>
    </div>
  );
}
