"use client";

import Link from "next/link";
import type { VenueOperationalAsset, VenueOperationalZone } from "rapid-cortex-shared";
import { C } from "@/lib/theme/rc-theme-tokens";

export function FacilityZoneDetails({
  zone,
  assets,
  incidentCount,
  venueCode,
  onClose,
}: {
  zone: VenueOperationalZone;
  assets: VenueOperationalAsset[];
  incidentCount: number;
  venueCode: string;
  onClose: () => void;
}) {
  const cameras = assets.filter((asset) => asset.type === "camera").length;
  const aeds = assets.filter((asset) => asset.type === "aed" || asset.type === "firstAid").length;
  const staff = assets.filter((asset) => asset.type === "security").length;
  const status = zone.status === "incident" ? "Incident" : zone.status === "attention" ? "Attention" : "Normal";

  return (
    <aside
      className="absolute bottom-12 left-3 z-30 w-[240px] rounded-md border p-3 shadow-lg"
      style={{ background: C.card, borderColor: C.border }}
      aria-label={`${zone.name} details`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-bold text-slate-100">{zone.name}</div>
          <div className="text-[11px] text-slate-400">{zone.levelId.replace(/-/g, " ")}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-200"
          aria-label="Close zone details"
        >
          ×
        </button>
      </div>
      <div className="mb-2 text-[11px] text-slate-300">
        Status: <span className="font-semibold">{status}</span>
      </div>
      <ul className="mb-3 space-y-0.5 text-[11px] text-slate-400">
        <li>Active Incidents: {incidentCount}</li>
        <li>Assigned Staff: {staff}</li>
        <li>Cameras: {cameras}</li>
        <li>AEDs: {aeds}</li>
      </ul>
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={`/venue/${encodeURIComponent(venueCode)}/incidents`}
          className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:border-orange-500"
          style={{ borderColor: C.border }}
        >
          View Incidents
        </Link>
        <Link
          href={`/venue/${encodeURIComponent(venueCode)}/cameras`}
          className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:border-orange-500"
          style={{ borderColor: C.border }}
        >
          View Cameras
        </Link>
      </div>
    </aside>
  );
}
