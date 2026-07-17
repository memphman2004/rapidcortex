"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AGENCY_TYPE_VALUES, buildAgencySlug, type CreateAgencyInput } from "rapid-cortex-shared";
import { RcAdminCreateAgencyRunbook } from "@/components/platform/rc-admin-create-agency-runbook";
import { postAgency } from "@/lib/api";
import { geocodeAddress } from "@/lib/geocode-address";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { AGENCY_REGION_OPTIONS, US_STATE_OPTIONS } from "@/lib/platform/location-options";

const defaults: CreateAgencyInput = {
  city: "",
  centerName: "",
  name: "",
  type: "city",
  state: "GA",
  region: "Midwest",
  primaryContactName: "",
  primaryContactEmail: "",
  deploymentMode: "side_by_side",
  protocolPackId: "default",
  retentionPolicyId: "default",
  integrationMode: "none",
  vertical: "core",
  planTier: "starter",
  pilotMode: false,
  addons: [],
};

function parseOptionalCoord(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

export default function NewAgencyPage() {
  const router = useRouter();
  const to = useJurisdictionLink();
  const [form, setForm] = useState<CreateAgencyInput>(defaults);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeHint, setGeocodeHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { slugPreview, slugError } = useMemo(() => {
    if (!form.state.trim() || !form.city.trim() || !form.centerName.trim()) {
      return { slugPreview: "", slugError: "" };
    }
    try {
      return {
        slugPreview: buildAgencySlug({
          state: form.state,
          city: form.city,
          centerName: form.centerName,
        }).slug,
        slugError: "",
      };
    } catch (e) {
      return { slugPreview: "", slugError: e instanceof Error ? e.message : "Invalid slug input" };
    }
  }, [form.state, form.city, form.centerName]);

  async function geocodeHq() {
    setGeocodeHint(null);
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
    if (!token) {
      setGeocodeHint("Mapbox token is not configured.");
      return;
    }
    const query = [form.city, form.state, "USA"].filter(Boolean).join(", ");
    if (!form.city.trim() || !form.state.trim()) {
      setGeocodeHint("Enter city and state first.");
      return;
    }
    setGeocodeBusy(true);
    try {
      const hit = await geocodeAddress(query, token, { types: "place,region,locality" });
      if (!hit) {
        setGeocodeHint("No geocode result.");
        return;
      }
      setLatInput(String(hit.lat));
      setLngInput(String(hit.lng));
      setGeocodeHint(`Geocoded: ${hit.placeName}`);
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const latitude = parseOptionalCoord(latInput);
    const longitude = parseOptionalCoord(lngInput);
    if (
      (latitude !== undefined && Number.isNaN(latitude)) ||
      (longitude !== undefined && Number.isNaN(longitude)) ||
      (latitude !== undefined && (latitude < -90 || latitude > 90)) ||
      (longitude !== undefined && (longitude < -180 || longitude > 180)) ||
      (latitude === undefined) !== (longitude === undefined)
    ) {
      setError("HQ coordinates must both be valid numbers, or both left blank.");
      return;
    }
    setBusy(true);
    try {
      const created = await postAgency({
        ...form,
        ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
      });
      router.push(to(`/admin/platform/agencies/${encodeURIComponent(created.agencyId)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <RcAdminCreateAgencyRunbook />

      <h1 className="text-lg font-semibold text-white">Create agency</h1>
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              State
            </label>
            <select
              required
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              {US_STATE_OPTIONS.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.value} — {state.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              City or County
            </label>
            <input
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Columbus"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Center / Agency Name
            </label>
            <input
              required
              value={form.centerName}
              onChange={(e) => setForm((f) => ({ ...f, centerName: e.target.value }))}
              placeholder="Muscogee County 911"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          {slugPreview ? (
            <div className="rounded border border-slate-700/60 bg-slate-950 px-3 py-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                Agency ID (auto-generated — cannot be changed after creation)
              </p>
              <p className="font-mono text-sm font-bold text-emerald-400">{slugPreview}</p>
            </div>
          ) : null}
          {slugError ? <p className="text-[11px] text-red-400">{slugError}</p> : null}
        </div>

        <fieldset className="space-y-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            HQ map pin (optional)
          </legend>
          <p className="text-[11px] text-slate-500">
            Shown on the RC Admin national deployments map. Geocode from city/state or enter
            manually.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-400">Latitude</span>
              <input
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                placeholder="33.7490"
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-400">Longitude</span>
              <input
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                placeholder="-84.3880"
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={geocodeBusy}
            onClick={() => void geocodeHq()}
            className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            {geocodeBusy ? "Geocoding…" : "Geocode from city/state"}
          </button>
          {geocodeHint ? <p className="text-[11px] text-slate-400">{geocodeHint}</p> : null}
        </fieldset>

        <label className="block text-sm">
          <span className="text-slate-400">Display name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Product vertical</span>
          <select
            value={form.vertical}
            onChange={(e) => {
              const vertical = e.target.value as CreateAgencyInput["vertical"];
              setForm((f) => ({
                ...f,
                vertical,
                type:
                  vertical === "campus"
                    ? "campus"
                    : vertical === "venue"
                      ? "venue"
                      : f.type,
              }));
            }}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="core">PSAP / RC Core</option>
            <option value="campus">Campus</option>
            <option value="venue">Venue</option>
            <option value="hospital">Hospital</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Type</span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as CreateAgencyInput["type"] }))
            }
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {AGENCY_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Region</span>
          <select
            required
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {AGENCY_REGION_OPTIONS.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Primary contact name</span>
          <input
            required
            value={form.primaryContactName}
            onChange={(e) => setForm((f) => ({ ...f, primaryContactName: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Primary contact email</span>
          <input
            required
            type="email"
            value={form.primaryContactEmail}
            onChange={(e) => setForm((f) => ({ ...f, primaryContactEmail: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || Boolean(slugError)}
          className="rounded-md bg-fuchsia-800 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create agency"}
        </button>
      </form>
    </div>
  );
}
