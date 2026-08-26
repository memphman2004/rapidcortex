"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { userCanManageQrLocations } from "@/lib/locations/qr-access";
import { createLocation, fetchLocations } from "@/lib/locations-api";
import { FIXTURE_CAMERAS, FIXTURE_ZONES } from "../_lib/venue-fixtures";
import {
  locationToVenueZone,
  mergeVenueZones,
  nextRcZoneCode,
  normalizeVenueZoneCode,
} from "../_lib/venue-zone-map";
import type { VenueZone } from "../_lib/venue-types";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,15}$/;

export function VenueZonesClient({ venueCode }: { venueCode: string }) {
  const org = venueCode.toUpperCase();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const agencyId = user?.agencyId?.trim() ?? "";
  const canAdd = userCanManageQrLocations(user);

  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const locationsQuery = useQuery({
    queryKey: ["qr-locations", agencyId, "venue", org],
    queryFn: () => fetchLocations(agencyId, { vertical: "venue", active: true }),
    enabled: isApiConfigured() && Boolean(agencyId),
  });

  const liveZones = useMemo(() => {
    const rows = locationsQuery.data ?? [];
    return rows
      .filter((row) => row.orgCode.toUpperCase() === org)
      .map((row) => locationToVenueZone(row, org));
  }, [locationsQuery.data, org]);

  const fixtures = useMemo(
    () => FIXTURE_ZONES.filter((zone) => zone.venueCode.toUpperCase() === org),
    [org],
  );

  const zones = useMemo(() => mergeVenueZones(liveZones, fixtures), [fixtures, liveZones]);

  const createMut = useMutation({
    mutationFn: async () => {
      const nextCode = normalizeVenueZoneCode(code);
      const nextLabel = label.trim();
      const nextLevel = level.trim() || "General";
      if (!CODE_PATTERN.test(nextCode)) {
        throw new Error("Use a short code like S118, G-A, or C1.");
      }
      if (!nextLabel) {
        throw new Error("Enter a zone name.");
      }
      if (zones.some((zone) => zone.code.toUpperCase() === nextCode)) {
        throw new Error(`Zone ${nextCode} already exists.`);
      }
      if (!agencyId) {
        throw new Error("Sign in to add a zone.");
      }
      if (!isApiConfigured()) {
        throw new Error("Platform connection isn’t configured.");
      }
      const zoneCodes = (locationsQuery.data ?? []).map((row) => row.zoneCode);
      return createLocation(agencyId, {
        locationName: nextLabel,
        building: nextLevel,
        zone: nextCode,
        zoneCode: nextRcZoneCode(zoneCodes),
        orgCode: org,
        vertical: "venue",
        active: true,
      });
    },
    onSuccess: async () => {
      setModalOpen(false);
      setCode("");
      setLabel("");
      setLevel("");
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["qr-locations", agencyId] });
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  function openModal() {
    setFormError(null);
    setModalOpen(true);
  }

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
          onClick={openModal}
          disabled={!canAdd}
          className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add Zone
        </button>
      </div>

      {!canAdd ? (
        <p className="text-sm text-slate-500">Your role can view zones but cannot create them.</p>
      ) : null}
      {locationsQuery.isError ? (
        <p className="text-sm text-amber-300">
          Could not load saved zones. Showing sample zones until the connection recovers.
        </p>
      ) : null}

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
            {zones.map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                venueCode={org}
                expanded={expandedZone === zone.code}
                onToggle={() =>
                  setExpandedZone((current) => (current === zone.code ? null : zone.code))
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="add-zone-title">
          <form
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              createMut.mutate();
            }}
          >
            <h2 id="add-zone-title" className="text-lg font-semibold text-white">
              Add zone
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Creates a venue scan point. Guests can report from this zone; print the QR from QR Codes.
            </p>
            <label className="mt-4 block text-sm text-slate-300">
              Code *
              <input
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="S118"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Name *
              <input
                required
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Section 118"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Level
              <input
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                placeholder="Lower Bowl"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
            {formError ? <p className="mt-3 text-sm text-red-400">{formError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={createMut.isPending}
                className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-60"
              >
                {createMut.isPending ? "Saving…" : "Save zone"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ZoneRow({
  zone,
  venueCode,
  expanded,
  onToggle,
}: {
  zone: VenueZone;
  venueCode: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const zoneCameras = FIXTURE_CAMERAS.filter((camera) => zone.cameraIds.includes(camera.id));

  return (
    <Fragment>
      <tr
        className="cursor-pointer border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-mono text-sm text-sky-300">{zone.code}</td>
        <td className="px-4 py-3 text-sm text-slate-200">{zone.label}</td>
        <td className="px-4 py-3 text-sm text-slate-300">{zone.level}</td>
        <td className="px-4 py-3 text-sm text-slate-300">{zone.cameraIds.length}</td>
        <td className="px-4 py-3 text-sm">
          <span
            className={`rounded-full border px-2 py-1 text-xs ${
              zone.activeIncidents > 0
                ? "border-red-500/30 bg-red-500/15 text-red-300"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {zone.activeIncidents}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-slate-400">{zone.qrUrl}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/venue/${venueCode}/qr-codes`}
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={(event) => event.stopPropagation()}
            >
              View QR
            </Link>
            <Link
              href={`/venue/${venueCode}/incidents?zone=${zone.code}`}
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={(event) => event.stopPropagation()}
            >
              View Incidents
            </Link>
          </div>
        </td>
      </tr>
      {expanded ? (
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
}
