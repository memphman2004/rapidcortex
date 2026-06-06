"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { AlertTriangle, ImageIcon, MapPin } from "lucide-react";
import {
  FIXTURE_CAMERAS,
  FIXTURE_STAFF,
  getFixtureIncident,
} from "../../_lib/venue-fixtures";
import { QrIncidentLocation } from "@/components/incidents/qr-incident-location";
import { IncidentSourceBadge } from "../../_components/IncidentSourceBadge";
import { IncidentStatusBadge } from "../../_components/IncidentStatusBadge";
import { incidentTypeLabel } from "../../_components/IncidentTypeIcon";
import { RelativeTime } from "../../_components/RelativeTime";

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ venueCode: string; incidentId: string }>;
}) {
  const { venueCode, incidentId } = use(params);
  const incident = getFixtureIncident(incidentId);
  const [note, setNote] = useState("");

  const timeline = useMemo(
    () =>
      incident
        ? [
            { at: incident.createdAt, text: `Report received via ${incident.source === "qr" ? "QR Code" : incident.source.toUpperCase()}` },
            { at: incident.updatedAt, text: incident.assignedTo ? `Assigned to ${incident.assignedTo}` : "Queued for assignment" },
            { at: incident.updatedAt, text: "Unit acknowledged and moved to scene" },
            { at: incident.updatedAt, text: "Supervisor review in progress" },
          ]
        : [],
    [incident],
  );

  if (!incident) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-100">Incident not found</h1>
        <p className="text-sm text-slate-400">This incident may have been archived or does not exist.</p>
      </div>
    );
  }

  const relatedCameras = FIXTURE_CAMERAS.filter((camera) => incident.cameraRefs.includes(camera.id));
  const assignedStaff = incident.assignedTo
    ? FIXTURE_STAFF.find((staff) => staff.name === incident.assignedTo || staff.currentIncidentId === incident.id)
    : null;
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <nav className="text-sm text-slate-400">
        <Link href={`/app/venue/${venueCode}`} className="hover:text-slate-200">
          Venue Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/app/venue/${venueCode}/incidents`} className="hover:text-slate-200">
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
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs uppercase text-slate-300">
            {incident.confidence} confidence
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
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
          <span>
            Created <RelativeTime iso={incident.createdAt} />
          </span>
          <span>
            Updated <RelativeTime iso={incident.updatedAt} />
          </span>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {!incident.assignedTo ? (
          <button
            type="button"
            onClick={() => console.log("TODO:", "assign to staff", incident.id)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Assign to Staff
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => console.log("TODO:", "mark responding", incident.id)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Mark Responding
        </button>
        <button
          type="button"
          onClick={() => console.log("TODO:", "resolve", incident.id)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Resolve
        </button>
        <button
          type="button"
          onClick={() => console.log("TODO:", "escalate to core", incident.id)}
          className="inline-flex items-center gap-1 rounded-md border border-violet-500/50 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20"
        >
          <AlertTriangle className="h-4 w-4" />
          Escalate to Core
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold text-white">Description</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{incident.description}</p>
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold text-white">Timeline</h2>
            <ol className="mt-3 space-y-3 border-l border-slate-700 pl-4">
              {timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-400" />
                  <p className="text-sm text-slate-200">{entry.text}</p>
                  <p className="text-xs text-slate-500">
                    <RelativeTime iso={entry.at} />
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold text-white">Incident Chat / Notes</h2>
            <div className="mt-3 space-y-2">
              <div className="rounded-md bg-slate-800/70 p-3">
                <p className="text-xs text-slate-400">Mia Thompson · 6 min ago</p>
                <p className="mt-1 text-sm text-slate-100">Unit en route from Section 120. ETA two minutes.</p>
              </div>
              <div className="rounded-md bg-slate-800/70 p-3">
                <p className="text-xs text-slate-400">Avery Cole · 3 min ago</p>
                <p className="mt-1 text-sm text-slate-100">Coordinate with guest services at nearest elevator.</p>
              </div>
              <div className="rounded-md bg-slate-800/70 p-3">
                <p className="text-xs text-slate-400">Dispatch · just now</p>
                <p className="mt-1 text-sm text-slate-100">Camera feed linked for zone verification.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add a note..."
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => {
                  console.log("TODO: send note", incident.id, note);
                  setNote("");
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Send
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold text-white">Media</h2>
            {incident.hasMedia ? (
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex aspect-video items-center justify-center rounded-md border border-slate-700 bg-slate-800/70">
                    <ImageIcon className="h-8 w-8 text-slate-500" />
                  </div>
                  <div className="flex aspect-video items-center justify-center rounded-md border border-slate-700 bg-slate-800/70">
                    <ImageIcon className="h-8 w-8 text-slate-500" />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-400">2 files attached</p>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-slate-400">No media attached</p>
                <button
                  type="button"
                  onClick={() => console.log("TODO: upload media", incident.id)}
                  className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
                >
                  Upload
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Location</h2>
            <p className="mt-2 text-sm text-slate-300">Zone: {incident.zoneLabel}</p>
            <p className="text-sm text-slate-400">Zone code: {incident.zoneCode}</p>
            <Link
              href={`/app/venue/${venueCode}/zones/${incident.zoneCode}`}
              className="mt-2 inline-block text-sm font-semibold text-sky-400 hover:text-sky-300"
            >
              View zone
            </Link>
            <div className="mt-3 flex h-48 flex-col items-center justify-center rounded-md border border-slate-700 bg-slate-800/60 text-slate-400">
              <MapPin className="mb-1 h-6 w-6" />
              <p className="text-xs">Map view — zone {incident.zoneCode}</p>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Nearby Cameras</h2>
            {relatedCameras.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {relatedCameras.map((camera) => (
                  <li key={camera.id} className="rounded-md border border-slate-700 bg-slate-950/50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-100">{camera.name}</p>
                        <p className="text-xs text-slate-400">{camera.id}</p>
                      </div>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${camera.status === "online" ? "bg-green-400" : ""} ${camera.status === "offline" ? "bg-red-400" : ""} ${camera.status === "degraded" ? "bg-amber-400" : ""}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => console.log("TODO: view camera", camera.id)}
                      className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No cameras registered for this zone</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Assigned Staff</h2>
            {assignedStaff ? (
              <div className="mt-2">
                <p className="text-sm text-slate-100">{assignedStaff.name}</p>
                <p className="text-xs text-slate-400">{assignedStaff.status.replace("_", " ")}</p>
                <button
                  type="button"
                  onClick={() => console.log("TODO: radio staff", assignedStaff.id)}
                  className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Radio
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-sm text-slate-400">Unassigned</p>
                <button
                  type="button"
                  onClick={() => console.log("TODO: assign", incident.id)}
                  className="mt-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Assign
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
            <h2 className="text-base font-semibold text-white">Incident Details</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Source</dt>
                <dd className="text-slate-200">{incident.source}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Status</dt>
                <dd className="text-slate-200">{incident.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Type</dt>
                <dd className="text-slate-200">{incidentTypeLabel(incident.type)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Confidence</dt>
                <dd className="text-slate-200">{incident.confidence}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Created</dt>
                <dd className="text-slate-200">
                  <RelativeTime iso={incident.createdAt} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-400">Last Updated</dt>
                <dd className="text-slate-200">
                  <RelativeTime iso={incident.updatedAt} />
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
