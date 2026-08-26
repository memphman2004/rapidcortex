"use client";

import Link from "next/link";
import type { VenueDemoIncident } from "rapid-cortex-shared";
import { statusLabel } from "@/lib/venue/operational-awareness/focus";
import { C } from "@/lib/theme/rc-theme-tokens";

export function IncidentFocusPanel({
  incident,
  venueCode,
  liveIncidentHref,
  onNotifyStaff,
  onClose,
}: {
  incident: VenueDemoIncident;
  venueCode: string;
  liveIncidentHref?: string | null;
  onNotifyStaff?: () => void;
  onClose: () => void;
}) {
  const reported = new Date(incident.reportedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const openHref = liveIncidentHref ?? `/venue/${encodeURIComponent(venueCode)}/incidents`;

  return (
    <aside
      className="absolute bottom-14 right-3 z-30 w-[260px] rounded-md border p-3 shadow-lg"
      style={{ background: C.card, borderColor: C.border }}
      aria-label="Incident focus"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-red-400">{incident.title}</div>
          <div className="text-[12px] text-slate-200">Section {incident.section}</div>
          <div className="text-[11px] text-slate-400">
            {incident.locationLabel} · {incident.levelId.replace(/-/g, " ")}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close incident focus">
          ×
        </button>
      </div>
      <div className="mb-2 text-[11px] text-slate-400">
        Reported: {reported}
        <div>
          Status: <span className="font-semibold text-slate-200">{statusLabel(incident.status)}</span>
        </div>
        {incident.isDemo ? (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-400">Demo distances</div>
        ) : null}
      </div>
      <div className="mb-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Nearby Resources</div>
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
          {incident.nearby.map((item) => (
            <li key={item.label}>
              {item.label} — {item.distanceFt} ft
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Available Cameras</div>
        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
          {incident.cameras.map((camera) => (
            <li key={camera}>{camera}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={openHref}
          className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:border-orange-500"
          style={{ borderColor: C.border }}
        >
          Open Incident
        </Link>
        <Link
          href={`/venue/${encodeURIComponent(venueCode)}/cameras`}
          className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:border-orange-500"
          style={{ borderColor: C.border }}
        >
          View Camera
        </Link>
        {onNotifyStaff ? (
          <button
            type="button"
            onClick={onNotifyStaff}
            className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:border-orange-500"
            style={{ borderColor: C.border }}
          >
            Notify Staff
          </button>
        ) : null}
      </div>
    </aside>
  );
}
