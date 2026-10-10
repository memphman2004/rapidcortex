"use client";

import { useCallback, useEffect, useState } from "react";
import type { GisDatasetCandidate, GisDatasetRecord } from "rapid-cortex-shared";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import {
  approveGisDataset,
  discoverGis,
  fetchGisDatasetGeoJson,
  importGisDataset,
  listGisDatasets,
} from "@/lib/gis/client";
import { isGisEnabled } from "@/lib/runtime-flags";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import Link from "next/link";

type Tab = "discover" | "layers";

export default function AdminGisPage() {
  const to = useJurisdictionLink();
  const [tab, setTab] = useState<Tab>("discover");
  const [serviceUrl, setServiceUrl] = useState("");
  const [candidates, setCandidates] = useState<GisDatasetCandidate[]>([]);
  const [datasets, setDatasets] = useState<GisDatasetRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeoJSON.FeatureCollection | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshDatasets = useCallback(async () => {
    const { items } = await listGisDatasets();
    setDatasets(items);
  }, []);

  useEffect(() => {
    if (!isGisEnabled()) return;
    void refreshDatasets().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load datasets"),
    );
  }, [refreshDatasets]);

  if (!isGisEnabled()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-300">
        <h1 className="text-xl font-semibold text-white">GIS Layers</h1>
        <p className="mt-3 text-sm text-slate-400">GIS Intelligence is disabled for this environment.</p>
        <Link href={to("/admin")} className="mt-6 inline-block text-sm text-sky-400">
          ← Back to administration
        </Link>
      </div>
    );
  }

  async function onDiscover() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { candidates: next } = await discoverGis(serviceUrl.trim() || undefined);
      setCandidates(next);
      setMessage(next.length ? `Found ${next.length} candidate layer(s).` : "No candidates returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discover failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(c: GisDatasetCandidate) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { dataset } = await importGisDataset({
        sourceUrl: c.sourceUrl,
        sourceType: c.sourceType,
        name: c.name,
      });
      setMessage(`Imported “${dataset.name}” (${dataset.featureCount ?? 0} features) — awaiting approval.`);
      await refreshDatasets();
      setTab("layers");
      const fc = await fetchGisDatasetGeoJson(dataset.datasetId);
      setPreview(fc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(datasetId: string, approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await approveGisDataset(datasetId, approved);
      setMessage(approved ? "Dataset approved for ops map." : "Dataset rejected.");
      await refreshDatasets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPreview(datasetId: string) {
    setBusy(true);
    setError(null);
    try {
      setPreview(await fetchGisDatasetGeoJson(datasetId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-slate-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">GIS Layers</h1>
          <p className="mt-1 text-sm text-slate-400">
            Discover ArcGIS FeatureServers, import GeoJSON, and approve layers for the ops map. Unverified
            datasets stay off the live map until approved.
          </p>
        </div>
        <Link href={to("/admin")} className="text-sm font-medium text-sky-400 hover:text-sky-300">
          ← Administration
        </Link>
      </div>

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {(["discover", "layers"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${
              tab === t ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-sky-800/60 bg-sky-950/30 px-3 py-2 text-sm text-sky-100">
          {message}
        </div>
      )}

      {tab === "discover" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={serviceUrl}
              onChange={(e) => setServiceUrl(e.target.value)}
              placeholder="https://…/FeatureServer (optional when GIS_MOCK=1)"
              className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onDiscover()}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Discover
            </button>
          </div>
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-700">
            {candidates.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-500">No candidates yet — run Discover.</li>
            )}
            {candidates.map((c) => (
              <li key={c.candidateId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">{c.name}</div>
                  <div className="truncate text-xs text-slate-500">{c.sourceUrl}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {c.geometryType ?? "unknown"} · {c.coverageHint ?? c.description ?? "—"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onImport(c)}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                >
                  Import
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "layers" && (
        <section className="space-y-4">
          <ul className="divide-y divide-slate-800 rounded-md border border-slate-700">
            {datasets.length === 0 && (
              <li className="px-3 py-4 text-sm text-slate-500">No imported datasets yet.</li>
            )}
            {datasets.map((d) => (
              <li key={d.datasetId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">{d.name}</div>
                  <div className="text-xs text-slate-400">
                    {d.approvalStatus} · {d.validationStatus} · {d.featureCount ?? 0} features · v{d.version}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onPreview(d.datasetId)}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                  >
                    Preview
                  </button>
                  {d.approvalStatus !== "approved" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onApprove(d.datasetId, true)}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      Approve
                    </button>
                  )}
                  {d.approvalStatus !== "rejected" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onApprove(d.datasetId, false)}
                      className="rounded-md bg-rose-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-700">
        <div className="border-b border-slate-700 px-3 py-2 text-xs font-semibold tracking-wide text-slate-400">
          MAP PREVIEW {preview ? "· temporary GeoJSON" : "· empty until Preview / Import"}
        </div>
        <div className="h-[420px]">
          <RapidCortexMap
            height="420px"
            theme="dark"
            showLayerControl={false}
            enableGisLayers={false}
            previewGeoJson={preview}
            centerLng={-83.373}
            centerLat={33.948}
            zoom={14}
          />
        </div>
      </section>
    </div>
  );
}
