"use client";

import { MapPin, QrCode } from "lucide-react";

export type QrIncidentLocationProps = {
  source?: string;
  zoneCode?: string | null;
  zoneLabel?: string | null;
  locationName?: string | null;
  building?: string | null;
  rcli?: string | null;
  compact?: boolean;
};

export function QrIncidentLocation({
  source,
  zoneCode,
  zoneLabel,
  locationName,
  building,
  rcli,
  compact = false,
}: QrIncidentLocationProps) {
  const isQr = source === "qr";
  const displayZone = zoneCode?.trim() || zoneLabel?.trim() || null;
  const displayName = locationName?.trim() || null;

  if (!isQr && !displayZone && !displayName) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
        {isQr ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-800/60 bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
            <QrCode className="h-3 w-3" />
            QR Scan
          </span>
        ) : null}
        {displayZone ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-100">
            <MapPin className="h-3.5 w-3.5 text-sky-400" />
            {displayZone.startsWith("RC") ? `Zone ${displayZone}` : displayZone}
          </span>
        ) : null}
        {displayName ? <span className="text-slate-400">{displayName}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isQr ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-800/60 bg-sky-950/40 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
            <QrCode className="h-3 w-3" />
            QR Scan
          </span>
        ) : null}
        {displayZone ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-200">
            <MapPin className="h-4 w-4" />
            {displayZone.startsWith("RC") ? `Zone ${displayZone}` : displayZone}
          </span>
        ) : null}
      </div>
      {displayName ? <p className="mt-2 text-sm font-medium text-slate-100">{displayName}</p> : null}
      {building ? <p className="mt-1 text-xs text-slate-400">{building}</p> : null}
      {rcli ? <p className="mt-2 font-mono text-[10px] text-slate-500">{rcli}</p> : null}
    </div>
  );
}
