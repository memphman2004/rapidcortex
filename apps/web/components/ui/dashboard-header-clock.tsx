"use client";

import { useEffect, useState } from "react";
import { useClockPreference } from "@/components/providers/clock-preference-provider";
import { formatHeaderClock } from "@/lib/clock-format";

/**
 * Live header clock — shown next to the 12h/24h picker on every dashboard chrome
 * that uses DashboardTypographyControls (campus, venue, transit, PSAP, dispatch, etc.).
 */
export function DashboardHeaderClock() {
  const { hour12 } = useClockPreference();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const clock = formatHeaderClock(now, hour12);

  return (
    <div
      className="min-w-[7.5rem] text-right"
      aria-live="polite"
      aria-atomic="true"
      title={clock.dateLine}
    >
      <div className="text-[10px] leading-tight text-[color:var(--rc-text-muted)]">{clock.dateLine}</div>
      <div className="text-[15px] font-semibold tabular-nums leading-tight text-[color:var(--rc-text-primary)]">
        {clock.timeMain}
        {clock.ampm ? (
          <span className="ml-1 text-[11px] font-medium text-[color:var(--rc-text-secondary)]">{clock.ampm}</span>
        ) : null}
      </div>
    </div>
  );
}
