"use client";

import Link from "next/link";
import { QrIncidentLocation } from "@/components/incidents/qr-incident-location";
import { IncidentSourceBadge } from "./IncidentSourceBadge";
import { IncidentStatusBadge } from "./IncidentStatusBadge";
import { IncidentTypeIcon, incidentTypeLabel } from "./IncidentTypeIcon";
import { RelativeTime } from "./RelativeTime";
import type { VenueIncident } from "../_lib/venue-types";

export function IncidentRow({ incident }: { incident: VenueIncident }) {
  const canAssign = incident.status === "open" || !incident.assignedTo;

  return (
    <tr className="border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40">
      <td className="px-4 py-3 text-sm font-medium text-sky-300">{incident.id}</td>
      <td className="px-4 py-3">
        <QrIncidentLocation
          compact
          source={incident.source}
          zoneCode={incident.zoneCode}
          zoneLabel={incident.zoneLabel}
          locationName={incident.qrLocationName}
          rcli={incident.qrRcli}
        />
      </td>
      <td className="px-4 py-3">
        <div className="inline-flex items-center gap-2 text-sm text-slate-200">
          <IncidentTypeIcon type={incident.type} />
          <span>{incidentTypeLabel(incident.type)}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <IncidentSourceBadge source={incident.source} />
      </td>
      <td className="px-4 py-3">
        <IncidentStatusBadge status={incident.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-300">
        <RelativeTime iso={incident.createdAt} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/app/venue/${incident.venueCode}/incidents/${incident.id}`}
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
          >
            View
          </Link>
          {canAssign ? (
            <button
              type="button"
              onClick={() => console.log("TODO: assign", incident.id)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Assign
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
