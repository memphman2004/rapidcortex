"use client";

import { Crosshair, MapPinOff, Radio } from "lucide-react";
import type { PinpointIqLocationStatusView } from "rapid-cortex-shared/pinpoint-surge";
import { formatLocationUpdateAge } from "rapid-cortex-shared/pinpoint-surge";

const STATUS_STYLES: Record<
  PinpointIqLocationStatusView["status"],
  { badge: string; icon: string; Icon: typeof Radio }
> = {
  live: {
    badge: "bg-emerald-600 text-white",
    icon: "text-emerald-400",
    Icon: Crosshair,
  },
  scan_only: {
    badge: "bg-rose-700 text-white",
    icon: "text-rose-400",
    Icon: MapPinOff,
  },
  stale: {
    badge: "bg-amber-600 text-white",
    icon: "text-amber-400",
    Icon: Radio,
  },
  sharing_stopped: {
    badge: "bg-slate-600 text-white",
    icon: "text-slate-400",
    Icon: MapPinOff,
  },
  location_unavailable: {
    badge: "bg-slate-600 text-white",
    icon: "text-slate-400",
    Icon: Radio,
  },
};

export function PinpointIqStatusCard({
  view,
  scanLocationLabel,
  compact = false,
}: {
  view: PinpointIqLocationStatusView;
  /** Human label for original QR/NFC scan (never treated as live GPS). */
  scanLocationLabel?: string | null;
  compact?: boolean;
}) {
  const style = STATUS_STYLES[view.status];
  const Icon = style.Icon;
  const age = formatLocationUpdateAge(view.lastLocationUpdateAt);
  const accuracy =
    view.locationAccuracyMeters != null
      ? `±${Math.round(view.locationAccuracyMeters)} meters`
      : null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${style.icon}`} aria-hidden />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide text-white">Pinpoint iQ</div>
            {!compact ? (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{view.description}</p>
            ) : null}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
          role="status"
          aria-label={`Location status: ${view.label}`}
        >
          <Radio className="h-3 w-3" aria-hidden />
          {view.label}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-[11px] text-slate-200">
        {view.status === "live" || view.status === "stale" || view.status === "sharing_stopped" ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-400">
                {view.status === "stale" || view.status === "sharing_stopped"
                  ? "Last known GPS update"
                  : "Last GPS update"}
              </dt>
              <dd className="font-medium text-slate-100">{age ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-400">Reported accuracy</dt>
              <dd className="font-medium text-slate-100">{accuracy ?? "—"}</dd>
            </div>
            {view.status === "stale" ? (
              <p className="text-[10px] font-medium text-amber-300/90">
                Coordinates are last known — not a live fix.
              </p>
            ) : null}
          </>
        ) : null}
        {view.status === "location_unavailable" ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-400">Consent</dt>
            <dd className="font-medium text-slate-100">Granted — waiting for GPS</dd>
          </div>
        ) : null}
        {scanLocationLabel ? (
          <div className="flex items-start justify-between gap-2 border-t border-slate-800 pt-2">
            <dt className="text-slate-400">Original scan location</dt>
            <dd className="max-w-[60%] text-right font-medium text-rose-200/90">{scanLocationLabel}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Location sharing</dt>
          <dd className="font-medium text-slate-100">
            {view.locationConsent ? "Consented" : "Not sharing"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
