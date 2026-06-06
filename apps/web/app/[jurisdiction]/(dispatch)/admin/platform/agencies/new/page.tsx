"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buildAgencySlug } from "rapid-cortex-shared";
import { RcAdminCreateAgencyRunbook } from "@/components/platform/rc-admin-create-agency-runbook";
import { postAgency } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { AGENCY_REGION_OPTIONS, US_STATE_OPTIONS } from "@/lib/platform/location-options";
import type { CreateAgencyInput } from "rapid-cortex-shared";

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

export default function NewAgencyPage() {
  const router = useRouter();
  const to = useJurisdictionLink();
  const [form, setForm] = useState<CreateAgencyInput>(defaults);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await postAgency(form);
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
          <span className="text-slate-400">Type</span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as CreateAgencyInput["type"] }))
            }
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {(["city", "county", "municipality", "regional_center", "pilot", "state_agency"] as const).map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ),
            )}
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
