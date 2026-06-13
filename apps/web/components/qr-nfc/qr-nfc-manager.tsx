"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateQRNFCInput, QRNFCRecord, ReportVertical } from "rapid-cortex-shared";
import { formatPhoneDisplay } from "rapid-cortex-shared";
import { features } from "@/lib/features";
import { NFCInstructions } from "./nfc-instructions";
import { SmsRoutingManager } from "@/components/sms-routing/sms-routing-manager";

type ListItem = Omit<QRNFCRecord, "qrImageBase64">;

type Props = {
  agencyId: string;
  agencyName?: string;
  vertical: ReportVertical;
  canCreate: boolean;
  canDeactivate: boolean;
  canDownload?: boolean;
  zoneLabel?: string;
  globalView?: boolean;
  apiBase?: string;
};

export function QRNFCManager({
  agencyId,
  agencyName = agencyId,
  vertical,
  canCreate,
  canDeactivate,
  canDownload = true,
  zoneLabel = "Zone / Location",
  globalView = false,
  apiBase = "/api/qr-nfc",
}: Props) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [created, setCreated] = useState<QRNFCRecord | null>(null);
  const [filterVertical, setFilterVertical] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  const [form, setForm] = useState<CreateQRNFCInput & { callNumber?: string }>({
    name: "",
    description: "",
    zoneName: "",
    vertical,
    reportType: "anonymous",
    nfcEnabled: true,
    callNumber: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!globalView) params.set("agencyId", agencyId);
      if (filterVertical !== "all") params.set("vertical", filterVertical);
      if (filterActive !== "all") params.set("active", filterActive === "active" ? "true" : "false");
      const path = globalView ? `${apiBase}/global?${params}` : `${apiBase}?${params}`;
      const res = await fetch(path, { credentials: "include" });
      const body = (await res.json()) as { items?: ListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load codes");
      setItems(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [agencyId, apiBase, filterActive, filterVertical, globalView]);

  useEffect(() => {
    if (!features.qrNfc) return;
    void load();
  }, [load]);

  if (!features.qrNfc) {
    return <p className="text-sm text-slate-400">QR & NFC management is disabled for this environment.</p>;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(apiBase, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        agencyId: globalView ? agencyId : undefined,
        callNumber: form.callNumber?.trim() || undefined,
      }),
    });
    const body = (await res.json()) as { record?: QRNFCRecord; error?: string };
    if (!res.ok) {
      setError(body.error ?? "Create failed");
      return;
    }
    setCreated(body.record ?? null);
    setModalOpen(false);
    void load();
  }

  async function setActive(qrId: string, active: boolean) {
    if (!canDeactivate) return;
    await fetch(`${apiBase}/${encodeURIComponent(qrId)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    void load();
  }

  async function deactivate(qrId: string) {
    if (!canDeactivate) return;
    await fetch(`${apiBase}/${encodeURIComponent(qrId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    void load();
  }

  function downloadPng(record: QRNFCRecord | ListItem, image?: string) {
    const src = image ?? (record as QRNFCRecord).qrImageBase64;
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `${record.name.replace(/\s+/g, "-")}-qr.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">QR Codes</h2>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setModalOpen(true);
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            + New QR Code
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Print on your sign</h3>
        <p className="mt-1 text-xs text-slate-500">
          Signs only need the QR code and NFC tag. When someone scans, they can tap to call or submit a report.
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
          <li>Scan the QR code</li>
          <li>Tap this sign (NFC)</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Register an agency SMS number below to enable the tap-to-call button on intake pages.
        </p>
        <div className="mt-2">
          <SmsRoutingManager
            agencyId={agencyId}
            agencyName={agencyName}
            defaultVertical={vertical === "campus" || vertical === "venue" ? vertical : "campus"}
            canManage={false}
            compact
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={filterVertical}
          onChange={(e) => setFilterVertical(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        >
          <option value="all">All verticals</option>
          <option value="campus">Campus</option>
          <option value="venue">Venue</option>
          <option value="911">911</option>
          <option value="hospital">Hospital</option>
          <option value="transit">Transit</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      {created ? (
        <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-4">
          <p className="font-medium text-emerald-200">Code created: {created.name}</p>
          {created.qrImageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={created.qrImageBase64} alt="QR code" className="mt-3 h-40 w-40 rounded bg-white p-2" />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadPng(created, created.qrImageBase64)} className="rounded border border-slate-600 px-2 py-1 text-xs">
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(`${created.url}?medium=nfc`)}
              className="rounded border border-slate-600 px-2 py-1 text-xs"
            >
              Copy NFC URL
            </button>
          </div>
          {created.nfcEnabled ? <NFCInstructions url={`${created.url}?medium=nfc`} /> : null}
        </section>
      ) : null}

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {items.map((row) => (
          <li key={row.qrId} className="space-y-2 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-100">{row.name}</p>
                <p className="text-xs text-slate-400">
                  {row.vertical} · {row.reportType}
                  {globalView ? ` · ${row.agencyId}` : ""}
                </p>
                {row.callNumber ? (
                  <p className="mt-1 text-xs text-emerald-400">
                    📞 {formatPhoneDisplay(row.callNumber)} · tap-to-call enabled
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    No call button — add an SMS routing number or set a call number on this code
                  </p>
                )}
              </div>
              {canDeactivate ? (
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => void setActive(row.qrId, e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  Active
                </label>
              ) : (
                <span className={`text-xs ${row.active ? "text-emerald-400" : "text-slate-500"}`}>
                  {row.active ? "Active" : "Inactive"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              QR: {row.scanCount} scans · NFC: {row.nfcTapCount} taps · Total: {row.totalEngagements}
              {row.lastEngagementAt ? ` · Last: ${new Date(row.lastEngagementAt).toLocaleString()}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {canDownload ? (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch(`${apiBase}/${encodeURIComponent(row.qrId)}`, { credentials: "include" });
                    const body = (await res.json()) as { record?: QRNFCRecord };
                    if (body.record?.qrImageBase64) downloadPng(row, body.record.qrImageBase64);
                  }}
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
                >
                  Download PNG
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(row.url)}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
              >
                Copy URL
              </button>
              {row.nfcEnabled ? (
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(`${row.url}?medium=nfc`)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
                >
                  Copy NFC URL
                </button>
              ) : null}
              {canDeactivate && row.active ? (
                <button
                  type="button"
                  onClick={() => void deactivate(row.qrId)}
                  className="rounded border border-rose-800 px-2 py-1 text-xs text-rose-300"
                >
                  Deactivate
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={(e) => void onCreate(e)} className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-slate-100">New QR / NFC code</h3>
            <label className="mt-4 block text-sm text-slate-300">
              Name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Description
              <input
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              {zoneLabel}
              <input
                value={form.zoneName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, zoneName: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              />
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Call number (optional)
              <input
                value={form.callNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, callNumber: e.target.value }))}
                placeholder="+17065551234"
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Leave blank to use the agency&apos;s default SMS number. Shown as a tap-to-call button when the QR
                code is scanned.
              </span>
            </label>
            <label className="mt-3 block text-sm text-slate-300">
              Report type *
              <select
                value={form.reportType}
                onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value as CreateQRNFCInput["reportType"] }))}
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
              >
                <option value="anonymous">Anonymous</option>
                <option value="identified">Identified</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.nfcEnabled ?? true}
                onChange={(e) => setForm((f) => ({ ...f, nfcEnabled: e.target.checked }))}
              />
              NFC enabled
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded border border-slate-600 px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white">
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
