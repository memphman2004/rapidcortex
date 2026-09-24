"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Upload } from "lucide-react";
import type { AddressIntelligence } from "rapid-cortex-shared";
import { AddressIntelPanel } from "@/components/dispatch/AddressIntelPanel";
import {
  featureSuiteAddressKey,
  featureSuiteFetch,
} from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

const HAZARD_TYPES = [
  "hazmat",
  "structural",
  "electrical",
  "gas",
  "water",
  "biological",
  "violence_history",
  "dog",
  "other",
] as const;

export function AddressIntelligenceClient({ params }: Props) {
  use(params);
  const enabled = isFeaturesSuiteUiEnabled();
  const qc = useQueryClient();

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [lookupKey, setLookupKey] = useState("");

  const [hazardType, setHazardType] = useState<(typeof HAZARD_TYPES)[number]>("dog");
  const [hazardSeverity, setHazardSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [hazardDesc, setHazardDesc] = useState("");
  const [hazardExpires, setHazardExpires] = useState("");
  const [geohash, setGeohash] = useState("00000000");

  const [accessNotes, setAccessNotes] = useState("");
  const [prePlanFacility, setPrePlanFacility] = useState("residential");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [floorLevel, setFloorLevel] = useState("1");

  const intelQ = useQuery({
    queryKey: ["address-intel-admin", lookupKey],
    queryFn: () =>
      featureSuiteFetch<AddressIntelligence>(`address/${lookupKey}/intelligence`),
    enabled: enabled && Boolean(lookupKey),
    retry: false,
  });

  const runLookup = () => {
    if (!street || !city || !state || !zip) return;
    setLookupKey(featureSuiteAddressKey(street, city, state, zip));
  };

  const hazardMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch(`address/${lookupKey}/hazard`, {
        method: "POST",
        body: JSON.stringify({
          normalizedAddress: decodeURIComponent(lookupKey),
          geohash8: geohash.slice(0, 8),
          hazard: {
            type: hazardType,
            severity: hazardSeverity,
            description: hazardDesc,
            expiresAt: hazardExpires ? new Date(hazardExpires).toISOString() : undefined,
          },
        }),
      }),
    onSuccess: () => {
      setHazardDesc("");
      void qc.invalidateQueries({ queryKey: ["address-intel-admin", lookupKey] });
    },
  });

  const prePlanMut = useMutation({
    mutationFn: () =>
      featureSuiteFetch(`address/${lookupKey}/preplan`, {
        method: "PUT",
        body: JSON.stringify({
          normalizedAddress: decodeURIComponent(lookupKey),
          geohash8: geohash.slice(0, 8),
          prePlan: {
            facilityType: prePlanFacility,
            contacts: contactName
              ? [
                  {
                    role: "owner",
                    name: contactName,
                    phone: contactPhone || "000-000-0000",
                    available24h: false,
                  },
                ]
              : [],
            notes: accessNotes || undefined,
          },
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["address-intel-admin", lookupKey] });
    },
  });

  const floorMut = useMutation({
    mutationFn: async () => {
      const prePlanId = intelQ.data?.prePlan?.prePlanId;
      if (!prePlanId) throw new Error("Save a pre-plan first");
      return featureSuiteFetch<{ uploadUrl: string; s3Key: string }>(
        `address/${lookupKey}/preplan/floor-plan`,
        {
          method: "POST",
          body: JSON.stringify({
            prePlanId,
            level: floorLevel,
            mimeType: "application/pdf",
          }),
        },
      );
    },
  });

  if (!enabled) {
    return (
      <div className="p-6 text-sm text-slate-400">Address intelligence is not enabled.</div>
    );
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0f1117] p-4 md:p-6 text-[#e2e4ea]">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <MapPin className="h-5 w-5 text-sky-400" />
          Address Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Search address records, add hazards, and manage pre-plans.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            placeholder="Street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
          />
          <input
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
          />
          <input
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
          />
          <input
            placeholder="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            placeholder="Geohash8 (for writes)"
            value={geohash}
            onChange={(e) => setGeohash(e.target.value)}
            className="w-40 rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={runLookup}
            className="rounded bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            Search
          </button>
        </div>
      </section>

      {intelQ.isFetching && <p className="text-xs text-slate-500">Loading…</p>}
      {intelQ.isError && (
        <p className="text-xs text-amber-300">
          No existing record (or error): {(intelQ.error as Error).message}. You can still add a
          hazard/pre-plan after searching.
        </p>
      )}
      {intelQ.data && <AddressIntelPanel intel={intelQ.data} />}

      {lookupKey && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4 text-amber-400" /> Add hazard
            </h2>
            <div className="space-y-2">
              <select
                value={hazardType}
                onChange={(e) => setHazardType(e.target.value as typeof hazardType)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {HAZARD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <select
                value={hazardSeverity}
                onChange={(e) => setHazardSeverity(e.target.value as typeof hazardSeverity)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {(["low", "medium", "high", "critical"] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <textarea
                value={hazardDesc}
                onChange={(e) => setHazardDesc(e.target.value)}
                placeholder="Description"
                rows={3}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={hazardExpires}
                onChange={(e) => setHazardExpires(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!hazardDesc || hazardMut.isPending}
                onClick={() => hazardMut.mutate()}
                className="rounded bg-amber-700 px-3 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
              >
                Save hazard
              </button>
              {hazardMut.isError && (
                <p className="text-xs text-red-400">{(hazardMut.error as Error).message}</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-800 bg-[#161b2e] p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-sky-400" /> Pre-plan & access
            </h2>
            <div className="space-y-2">
              <select
                value={prePlanFacility}
                onChange={(e) => setPrePlanFacility(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              >
                {["residential", "commercial", "school", "hospital", "government", "other"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
              <input
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <input
                placeholder="Contact phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Access notes / gate codes (supervisor-visible)"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-700 bg-[#0f1117] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={prePlanMut.isPending}
                onClick={() => prePlanMut.mutate()}
                className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:opacity-50"
              >
                Save pre-plan
              </button>
              <div className="flex items-center gap-2 pt-2">
                <input
                  value={floorLevel}
                  onChange={(e) => setFloorLevel(e.target.value)}
                  placeholder="Level"
                  className="w-24 rounded border border-slate-700 bg-[#0f1117] px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={floorMut.isPending}
                  onClick={() => floorMut.mutate()}
                  className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  Get floor plan upload URL
                </button>
              </div>
              {floorMut.data?.uploadUrl && (
                <p className="break-all text-[11px] text-teal-300">
                  Upload URL ready — PUT PDF to: {floorMut.data.uploadUrl.slice(0, 80)}…
                </p>
              )}
              {(prePlanMut.isError || floorMut.isError) && (
                <p className="text-xs text-red-400">
                  {((prePlanMut.error || floorMut.error) as Error).message}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
