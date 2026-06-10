"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ImageIcon, MapPin } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { QrIncidentLocation } from "@/components/incidents/qr-incident-location";
import { fetchVenueIncident } from "@/lib/venue/venue-incident-api";
import { IncidentSourceBadge } from "../../_components/IncidentSourceBadge";
import { IncidentStatusBadge } from "../../_components/IncidentStatusBadge";
import { incidentTypeLabel } from "../../_components/IncidentTypeIcon";
import { RelativeTime } from "../../_components/RelativeTime";
import {
  ViewAvailableRingCamerasButton,
  isRingAvailableCamerasEnabled,
  isRingEnabled,
} from "@/src/features/connect/ring";
import type { RingRole } from "@/src/features/connect/ring/ring-types";

type Tab = "overview" | "media";

export function VenueIncidentDetailClient({
  venueCode,
  incidentId,
}: {
  venueCode: string;
  incidentId: string;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("overview");

  const incidentQuery = useQuery({
    queryKey: ["venue-incident", venueCode, incidentId],
    queryFn: () => fetchVenueIncident(venueCode, incidentId),
  });

  const incident = incidentQuery.data;
  const ringEnabled = isRingEnabled();
  const ringCamerasEnabled = isRingAvailableCamerasEnabled();

  const timeline = useMemo(
    () =>
      incident
        ? [
            {
              at: incident.createdAt,
              text: `Report received via ${incident.source === "qr" ? "QR Code" : incident.source.toUpperCase()}`,
            },
            {
              at: incident.updatedAt,
              text: incident.assignedTo ? `Assigned to ${incident.assignedTo}` : "Queued for assignment",
            },
          ]
        : [],
    [incident],
  );

  if (incidentQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-400">Loading incident…</p>;
  }

  if (incidentQuery.isError || !incident) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-100">Incident not found</h1>
        <p className="text-sm text-slate-400">This incident may have been archived or does not exist.</p>
      </div>
    );
  }

  const venueBase = `/app/venue/${venueCode}`;
  const hasLocation = incident.latitude != null && incident.longitude != null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <nav className="text-sm text-slate-400">
        <Link href={venueBase} className="hover:text-slate-200">
          Venue Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href={`${venueBase}/incidents`} className="hover:text-slate-200">
          Incidents
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-200">{incident.id}</span>
      </nav>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h1 className="text-2xl font-bold text-white">{incident.id}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IncidentStatusBadge status={incident.status} />
          <IncidentSourceBadge source={incident.source} />
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300">
            {incidentTypeLabel(incident.type)}
          </span>
        </div>
        <div className="mt-4">
          <QrIncidentLocation
            source={incident.source}
            zoneCode={incident.zoneCode}
            zoneLabel={incident.zoneLabel}
            locationName={incident.qrLocationName}
            rcli={incident.qrRcli}
          />
        </div>
        <p className="mt-3 text-sm text-slate-300">{incident.description}</p>
      </section>

      <div className="flex gap-2 border-b border-slate-800">
        {(["overview", "media"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-semibold capitalize ${
              tab === key ? "border-b-2 border-orange-400 text-orange-200" : "text-slate-400"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Timeline</h2>
            <ul className="mt-3 space-y-2">
              {timeline.map((entry) => (
                <li key={entry.at} className="text-sm text-slate-300">
                  <RelativeTime iso={entry.at} /> — {entry.text}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Location</h2>
            <p className="mt-2 text-sm text-slate-300">Zone: {incident.zoneLabel}</p>
            <div className="mt-3 flex h-48 flex-col items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 text-slate-400">
              <MapPin className="mb-1 h-6 w-6" />
              <p className="text-xs">Zone {incident.zoneCode}</p>
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <h2 className="text-lg font-semibold text-white">Media</h2>
          {incident.hasMedia ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex aspect-video items-center justify-center rounded-md border border-slate-700 bg-slate-800/70">
                <ImageIcon className="h-8 w-8 text-slate-500" />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No uploaded media for this incident.</p>
          )}

          {ringEnabled && ringCamerasEnabled && user ? (
            <div className="mt-6 space-y-3 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Ring Cameras</h3>
              <p className="text-xs text-slate-500">
                Find nearby Ring cameras and send an emergency consent request to the device owner.
              </p>
              <ViewAvailableRingCamerasButton
                incidentId={incident.id}
                incidentLatitude={hasLocation ? incident.latitude! : null}
                incidentLongitude={hasLocation ? incident.longitude! : null}
                userRole={user.role as RingRole}
              />
              {!hasLocation ? (
                <p className="text-xs text-amber-300">
                  Incident GPS is required before Ring camera discovery can run.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
