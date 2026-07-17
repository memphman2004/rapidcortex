"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { AgencyTenant } from "rapid-cortex-shared";
import { patchAgency } from "@/lib/api";
import { geocodeAddress } from "@/lib/geocode-address";

type Props = {
  agency: AgencyTenant;
};

function parseCoord(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

/** Editable HQ pin for the RC Admin national deployments map. */
export function AgencyHqCoordinatesCard({ agency }: Props) {
  const queryClient = useQueryClient();
  const [lat, setLat] = useState(
    agency.latitude != null && Number.isFinite(agency.latitude) ? String(agency.latitude) : "",
  );
  const [lng, setLng] = useState(
    agency.longitude != null && Number.isFinite(agency.longitude) ? String(agency.longitude) : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);

  useEffect(() => {
    setLat(
      agency.latitude != null && Number.isFinite(agency.latitude) ? String(agency.latitude) : "",
    );
    setLng(
      agency.longitude != null && Number.isFinite(agency.longitude)
        ? String(agency.longitude)
        : "",
    );
  }, [agency.agencyId, agency.latitude, agency.longitude]);

  const saveMut = useMutation({
    mutationFn: async (coords?: { latitude: number | null; longitude: number | null }) => {
      if (coords) {
        return patchAgency(agency.agencyId, coords);
      }
      const parsedLat = parseCoord(lat);
      const parsedLng = parseCoord(lng);
      if (parsedLat === null && parsedLng === null) {
        return patchAgency(agency.agencyId, { latitude: null, longitude: null });
      }
      if (
        parsedLat === null ||
        parsedLng === null ||
        Number.isNaN(parsedLat) ||
        Number.isNaN(parsedLng) ||
        parsedLat < -90 ||
        parsedLat > 90 ||
        parsedLng < -180 ||
        parsedLng > 180
      ) {
        throw new Error("Enter valid latitude (−90…90) and longitude (−180…180), or clear both.");
      }
      return patchAgency(agency.agencyId, { latitude: parsedLat, longitude: parsedLng });
    },
    onSuccess: () => {
      setMessage("HQ coordinates saved.");
      void queryClient.invalidateQueries({ queryKey: ["agency", agency.agencyId] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "deployments-map"] });
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Save failed");
    },
  });

  async function geocodeFromCityState() {
    setMessage(null);
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
    if (!token) {
      setMessage("Mapbox token is not configured.");
      return;
    }
    const query = [agency.city, agency.state, "USA"].filter(Boolean).join(", ");
    if (!query.trim()) {
      setMessage("City and state are required to geocode.");
      return;
    }
    setGeocodeBusy(true);
    try {
      const hit = await geocodeAddress(query, token, { types: "place,region,locality" });
      if (!hit) {
        setMessage("No geocode result for this city/state.");
        return;
      }
      setLat(String(hit.lat));
      setLng(String(hit.lng));
      setMessage(`Geocoded: ${hit.placeName}`);
    } finally {
      setGeocodeBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        HQ map coordinates
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Used on the RC Admin national deployments map. Optional — leave blank to omit this tenant.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Latitude</span>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="33.7490"
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Longitude</span>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-84.3880"
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={geocodeBusy}
          onClick={() => void geocodeFromCityState()}
          className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          {geocodeBusy ? "Geocoding…" : "Geocode from city/state"}
        </button>
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={() => {
            setMessage(null);
            saveMut.mutate(undefined);
          }}
          className="rounded-md border border-violet-800/60 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-950/60 disabled:opacity-40"
        >
          {saveMut.isPending ? "Saving…" : "Save coordinates"}
        </button>
        <button
          type="button"
          disabled={saveMut.isPending}
          onClick={() => {
            setLat("");
            setLng("");
            setMessage(null);
            saveMut.mutate({ latitude: null, longitude: null });
          }}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-900 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      {message ? (
        <p
          className={`mt-2 text-xs ${
            message.toLowerCase().includes("fail") ||
            message.toLowerCase().includes("enter valid") ||
            message.toLowerCase().includes("no geocode") ||
            message.toLowerCase().includes("required") ||
            message.toLowerCase().includes("not configured")
              ? "text-rose-300"
              : "text-emerald-300"
          }`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
