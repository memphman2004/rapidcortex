"use client";

import Link from "next/link";
import { Fragment, use, useMemo, useState } from "react";
import { FIXTURE_CAMERAS, FIXTURE_ZONES } from "../_lib/venue-fixtures";

export default function VenueZonesPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const zones = useMemo(() => FIXTURE_ZONES, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Zones</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage venue zones. Each zone has a QR code and camera list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => console.log("TODO: add zone")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Add Zone
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/40">
        <table className="min-w-full">
          <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-300">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Cameras</th>
              <th className="px-4 py-3">Active Incidents</th>
              <th className="px-4 py-3">QR Link</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => {
              const isExpanded = expandedZone === zone.code;
              const zoneCameras = FIXTURE_CAMERAS.filter((camera) => zone.cameraIds.includes(camera.id));

              return (
                <Fragment key={zone.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40"
                    onClick={() => setExpandedZone((current) => (current === zone.code ? null : zone.code))}
                  >
                    <td className="px-4 py-3 font-mono text-sm text-sky-300">{zone.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">{zone.label}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{zone.level}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{zone.cameraIds.length}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${zone.activeIncidents > 0 ? "border-red-500/30 bg-red-500/15 text-red-300" : "border-slate-700 bg-slate-900 text-slate-300"}`}
                      >
                        {zone.activeIncidents}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{zone.qrUrl}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/app/venue/${venueCode}/qr-codes`}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View QR
                        </Link>
                        <Link
                          href={`/app/venue/${venueCode}/incidents?zone=${zone.code}`}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                          onClick={(event) => event.stopPropagation()}
                        >
                          View Incidents
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="border-b border-slate-800/70 bg-slate-900/50">
                      <td colSpan={7} className="px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Cameras in {zone.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {zoneCameras.length > 0 ? (
                            zoneCameras.map((camera) => (
                              <span
                                key={camera.id}
                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
                              >
                                {camera.name}
                              </span>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">No cameras mapped to this zone.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
