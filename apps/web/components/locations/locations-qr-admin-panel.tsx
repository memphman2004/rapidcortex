"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MapPin, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { QRLocation, QRLocationVertical } from "rapid-cortex-shared";
import { qrReportUrl } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import {
  bulkImportLocations,
  createLocation,
  csvRowsToBulkPayload,
  deactivateLocation,
  fetchLocations,
  parseCsvRows,
  qrAssetUrl,
  type CreateLocationInput,
} from "@/lib/locations-api";
import { QrInlinePreview } from "./qr-inline-preview";

const VERTICALS: QRLocationVertical[] = ["campus", "venue", "core"];

export function LocationsQrAdminPanel({
  defaultVertical = "campus",
  defaultOrgCode = "",
  canManage = true,
}: {
  defaultVertical?: QRLocationVertical;
  defaultOrgCode?: string;
  /** When false, list/download only — no create, bulk import, or deactivate. */
  canManage?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const agencyId = user?.agencyId?.trim() ?? "";
  const [vertical, setVertical] = useState<QRLocationVertical>(defaultVertical);
  const [orgCode, setOrgCode] = useState(defaultOrgCode);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState<CreateLocationInput>({
    locationName: "",
    building: "",
    floor: "",
    zone: "",
    zoneCode: "",
    orgCode: defaultOrgCode,
    vertical: defaultVertical,
    active: true,
  });
  const [bulkPreview, setBulkPreview] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultOrgCode) setOrgCode(defaultOrgCode);
  }, [defaultOrgCode]);

  const locationsQuery = useQuery({
    queryKey: ["qr-locations", agencyId, vertical, activeOnly],
    queryFn: () => fetchLocations(agencyId, { vertical, active: activeOnly }),
    enabled: isApiConfigured() && Boolean(agencyId),
  });

  const filtered = useMemo(() => {
    const rows = locationsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.locationName.toLowerCase().includes(q) ||
        row.building?.toLowerCase().includes(q) ||
        row.zoneCode.toLowerCase().includes(q) ||
        row.rcli.toLowerCase().includes(q),
    );
  }, [locationsQuery.data, search]);

  const createMut = useMutation({
    mutationFn: () =>
      createLocation(agencyId, {
        ...form,
        orgCode: form.orgCode || orgCode,
        vertical,
      }),
    onSuccess: () => {
      setShowAdd(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["qr-locations", agencyId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkImportLocations(agencyId, {
        vertical,
        orgCode: orgCode.trim().toUpperCase(),
        rows: csvRowsToBulkPayload(bulkPreview),
      }),
    onSuccess: () => {
      setShowBulk(false);
      setBulkPreview([]);
      void queryClient.invalidateQueries({ queryKey: ["qr-locations", agencyId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (rcli: string) => deactivateLocation(agencyId, rcli),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["qr-locations", agencyId] }),
    onError: (e: Error) => setError(e.message),
  });

  if (!agencyId) {
    return <p className="text-sm text-slate-400">Sign in to manage QR locations for your organization.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Vertical
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value as QRLocationVertical)}
            className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {VERTICALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Org code
          <input
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
            className="mt-1 block rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="CSU"
          />
        </label>
        <label className="text-sm text-slate-300">
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 block w-48 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="Name, zone, RCLI…"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Active only
        </label>
        <button
          type="button"
          onClick={() => {
            setForm((f) => ({ ...f, orgCode, vertical }));
            setShowAdd(true);
          }}
          disabled={!canManage}
          className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add location
        </button>
        <button
          type="button"
          onClick={() => setShowBulk(true)}
          disabled={!canManage}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          Bulk import
        </button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">QR</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Building</th>
              <th className="px-4 py-3">RCLI</th>
              <th className="px-4 py-3">Scans</th>
              <th className="px-4 py-3">Last scan</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locationsQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-400">
                  Loading locations…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-400">
                  No locations found. Add one or import a CSV.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <LocationRow
                  key={row.rcli}
                  row={row}
                  agencyId={agencyId}
                  canManage={canManage}
                  onDeactivate={() => deactivateMut.mutate(row.rcli)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">Add location</h2>
            <div className="mt-4 grid gap-3">
              {(["locationName", "building", "floor", "zone", "zoneCode", "orgCode"] as const).map((field) => (
                <label key={field} className="text-sm text-slate-300">
                  {field}
                  <input
                    value={form[field] ?? ""}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        [field]: field === "zoneCode" || field === "orgCode" ? e.target.value.toUpperCase() : e.target.value,
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-md px-3 py-2 text-sm text-slate-300">
                Cancel
              </button>
              <button
                type="button"
                disabled={createMut.isPending}
                onClick={() => createMut.mutate()}
                className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBulk ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">Bulk import CSV</h2>
            <p className="mt-2 text-xs text-slate-400">
              Columns: locationName, building, floor, zone, zoneCode, lat, lng
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-4 block w-full text-sm text-slate-300"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBulkPreview(parseCsvRows(await file.text()));
              }}
            />
            {bulkPreview.length > 0 ? (
              <p className="mt-3 text-sm text-slate-300">{bulkPreview.length} rows ready to import</p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowBulk(false)} className="rounded-md px-3 py-2 text-sm text-slate-300">
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkMut.isPending || bulkPreview.length === 0 || !orgCode.trim()}
                onClick={() => bulkMut.mutate()}
                className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocationRow({
  row,
  agencyId,
  canManage,
  onDeactivate,
}: {
  row: QRLocation;
  agencyId: string;
  canManage: boolean;
  onDeactivate: () => void;
}) {
  const reportUrl = qrReportUrl(row.rcli);

  return (
    <tr className="border-t border-slate-800/80 text-slate-200">
      <td className="px-4 py-3">
        <QrInlinePreview
          rcli={row.rcli}
          agencyId={agencyId}
          locationName={row.locationName}
          zoneCode={row.zoneCode}
        />
      </td>
      <td className="px-4 py-3 font-medium text-sky-300">{row.zoneCode}</td>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
          <div>
            <p>{row.locationName}</p>
            {row.floor ? <p className="text-xs text-slate-500">{row.floor}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">{row.building ?? "—"}</td>
      <td className="px-4 py-3 font-mono text-xs">{row.rcli}</td>
      <td className="px-4 py-3">{row.scanCount}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{row.lastScannedAt?.slice(0, 16) ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            Open
          </a>
          <a
            href={qrAssetUrl(agencyId, row.rcli, "png")}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            <Download className="h-3 w-3" />
            PNG
          </a>
          <a
            href={qrAssetUrl(agencyId, row.rcli, "pdf")}
            className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
          >
            <Download className="h-3 w-3" />
            PDF
          </a>
          {row.active && canManage ? (
            <button
              type="button"
              onClick={onDeactivate}
              className="rounded border border-red-900/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
            >
              Deactivate
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
