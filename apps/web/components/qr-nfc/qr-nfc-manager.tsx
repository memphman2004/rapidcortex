"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateQRNFCInput, QRNFCRecord, ReportVertical } from "rapid-cortex-shared";
import { formatPhoneDisplay, isMarketingSiteQrRecord, matchesCampusSiteScope, normalizePhoneE164 } from "rapid-cortex-shared";
import { features } from "@/lib/features";
import { qrNfcSetupGuidePath } from "@/lib/marketing-links";
import { NFCInstructions } from "./nfc-instructions";
import { QrNfcUsagePanel } from "./qr-nfc-usage-panel";
import { TradeShowMarketingQrPanel } from "./trade-show-marketing-qr";
import { SmsRoutingManager } from "@/components/sms-routing/sms-routing-manager";
import { fetchVenueCameraRegistry, type CameraApiVertical } from "@/lib/venue/venue-camera-api";
import type { VenueCamera } from "rapid-cortex-shared";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";

type ListItem = Omit<QRNFCRecord, "qrImageBase64">;
type MediumView = "qr" | "nfc" | "all";

type Props = {
  agencyId: string;
  agencyName?: string;
  vertical: ReportVertical;
  canCreate: boolean;
  canDeactivate: boolean;
  canDownload?: boolean;
  zoneLabel?: string;
  globalView?: boolean;
  /** Rapid Cortex site QR/NFC (www.rapidcortex.us). RC internal logins only. */
  showSiteQr?: boolean;
  /** Hide the manager H2 when the page already has a campus/venue heading. */
  hideHeading?: boolean;
  /** Tenant consoles: omit platform site QR and Location QR (RCLI) usage. */
  tenantConsole?: boolean;
  apiBase?: string;
};

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Clipboard copy failed");
}

export function QRNFCManager({
  agencyId,
  agencyName = agencyId,
  vertical,
  canCreate,
  canDeactivate,
  canDownload = true,
  zoneLabel = "Zone / Location",
  globalView = false,
  showSiteQr = false,
  hideHeading = false,
  tenantConsole = false,
  apiBase = "/api/qr-nfc",
}: Props) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<QRNFCRecord | null>(null);
  const [filterVertical, setFilterVertical] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [mediumView, setMediumView] = useState<MediumView>("all");
  const [expandedNfcId, setExpandedNfcId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateQRNFCInput & { callNumber?: string }>({
    name: "",
    description: "",
    zoneName: "",
    buildingId: "",
    floor: "",
    cameraIds: [],
    siteCode: "",
    vertical,
    reportType: "anonymous",
    nfcEnabled: true,
    callNumber: "",
  });
  const [registryCameras, setRegistryCameras] = useState<VenueCamera[]>([]);
  const [assigningQrId, setAssigningQrId] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState<{
    buildingId: string;
    floor: string;
    cameraIds: string[];
    siteCode: string;
  }>({ buildingId: "", floor: "", cameraIds: [], siteCode: "" });

  const locationCamerasEnabled = vertical === "campus" || vertical === "venue";
  const cameraApiVertical: CameraApiVertical = vertical === "campus" ? "campus" : "venue";
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(
    vertical === "campus" ? agencyId : "",
  );

  const flash = useCallback((tone: "ok" | "err", text: string) => {
    setActionMsg({ tone, text });
  }, []);

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
      setItems((body.items ?? []).filter((row) => !isMarketingSiteQrRecord(row)));
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

  useEffect(() => {
    if (!features.qrNfc || !locationCamerasEnabled) return;
    void fetchVenueCameraRegistry(agencyId, cameraApiVertical)
      .then(setRegistryCameras)
      .catch(() => setRegistryCameras([]));
  }, [agencyId, cameraApiVertical, locationCamerasEnabled]);

  const visibleItems = useMemo(() => {
    const byMedium =
      mediumView === "nfc" ? items.filter((row) => row.nfcEnabled) : items;
    if (vertical !== "campus") return byMedium;
    return byMedium.filter((row) =>
      matchesCampusSiteScope(row.siteCode, scope, primarySiteCode),
    );
  }, [items, mediumView, vertical, scope, primarySiteCode]);

  if (!features.qrNfc) {
    return <p className="text-sm text-slate-400">QR & NFC management is disabled for this environment.</p>;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setModalError(null);
    try {
      const rawCall = form.callNumber?.trim();
      let callNumber: string | undefined;
      if (rawCall) {
        callNumber = normalizePhoneE164(rawCall);
        if (!/^\+[1-9]\d{6,14}$/.test(callNumber)) {
          setModalError("Phone must be E.164 format (e.g. +17065551234 or 7065551234)");
          return;
        }
      }

      const res = await fetch(apiBase, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          agencyId,
          callNumber,
          buildingId: form.buildingId?.trim() || undefined,
          floor: form.floor?.trim() || undefined,
          cameraIds: locationCamerasEnabled ? form.cameraIds ?? [] : undefined,
          siteCode: form.siteCode?.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { record?: QRNFCRecord; error?: string };
      if (!res.ok) {
        setModalError(body.error ?? `Create failed (${res.status})`);
        return;
      }
      setCreated(body.record ?? null);
      setModalOpen(false);
      setForm({
        name: "",
        description: "",
        zoneName: "",
        buildingId: "",
        floor: "",
        cameraIds: [],
        siteCode: "",
        vertical,
        reportType: "anonymous",
        nfcEnabled: true,
        callNumber: "",
      });
      if (body.record?.nfcEnabled) setMediumView("nfc");
      void load();
    } catch {
      setModalError("Network error — please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function setActive(qrId: string, active: boolean) {
    if (!canDeactivate) return;
    setBusyId(qrId);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(qrId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        flash("err", body.error ?? `Could not update status (${res.status})`);
        return;
      }
      flash("ok", active ? "Code activated." : "Code deactivated.");
      void load();
    } catch {
      flash("err", "Network error updating status.");
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(qrId: string) {
    if (!canDeactivate) return;
    if (!window.confirm("Deactivate this code? Scans and NFC taps will stop working.")) return;
    setBusyId(qrId);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(qrId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        flash("err", body.error ?? `Deactivate failed (${res.status})`);
        return;
      }
      flash("ok", "Code deactivated.");
      void load();
    } catch {
      flash("err", "Network error deactivating code.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveCameraAssignment(row: ListItem) {
    setBusyId(row.qrId);
    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(row.qrId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: assignDraft.buildingId.trim() || undefined,
          floor: assignDraft.floor.trim() || undefined,
          cameraIds: assignDraft.cameraIds,
          siteCode: assignDraft.siteCode.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        flash("err", body.error ?? `Could not assign cameras (${res.status})`);
        return;
      }
      flash("ok", "Area cameras saved. A scan of this code opens these cameras.");
      setAssigningQrId(null);
      void load();
    } catch {
      flash("err", "Network error assigning cameras.");
    } finally {
      setBusyId(null);
    }
  }

  function cameraLabel(id: string): string {
    const cam = registryCameras.find((c) => c.cameraId === id);
    return cam ? `${cam.displayName} (${cam.cameraId})` : id;
  }

  function downloadPng(record: QRNFCRecord | ListItem, image?: string) {
    const src = image ?? (record as QRNFCRecord).qrImageBase64;
    if (!src) {
      flash("err", "No QR image available for this code.");
      return;
    }
    const a = document.createElement("a");
    a.href = src;
    a.download = `${record.name.replace(/\s+/g, "-")}-qr.png`;
    a.click();
    flash("ok", "QR PNG download started.");
  }

  async function onDownloadPng(row: ListItem) {
    setBusyId(row.qrId);
    try {
      const params = new URLSearchParams();
      if (row.agencyId) params.set("agencyId", row.agencyId);
      const qs = params.toString();
      const res = await fetch(
        `${apiBase}/${encodeURIComponent(row.qrId)}${qs ? `?${qs}` : ""}`,
        { credentials: "include" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        record?: QRNFCRecord;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        flash("err", body.error ?? body.message ?? `Download failed (${res.status})`);
        return;
      }
      if (!body.record?.qrImageBase64) {
        flash("err", "QR image missing on server — recreate the code or contact support.");
        return;
      }
      downloadPng(row, body.record.qrImageBase64);
    } catch {
      flash("err", "Network error downloading QR PNG.");
    } finally {
      setBusyId(null);
    }
  }

  async function onCopy(label: string, text: string) {
    try {
      await copyText(text);
      flash("ok", `${label} copied.`);
    } catch {
      flash("err", `Could not copy ${label.toLowerCase()}.`);
    }
  }

  const title =
    mediumView === "nfc" ? "NFC Tags" : mediumView === "qr" ? "QR Codes" : "QR & NFC Codes";

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-3 ${hideHeading ? "justify-end" : "justify-between"}`}>
        {hideHeading ? <span className="sr-only">{title}</span> : <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={qrNfcSetupGuidePath()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
          >
            Setup guide (PDF)
          </a>
          <a
            href="#qr-nfc-usage"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-sky-500/60 hover:text-sky-200"
          >
            Usage
          </a>
          {showSiteQr ? (
          <a
            href="#rc-marketing-qr"
            className="rounded-md border border-amber-700/70 px-3 py-1.5 text-sm font-medium text-amber-200 hover:border-amber-500/80 hover:text-amber-100"
          >
            + Rapid Cortex site QR
          </a>
          ) : null}
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setModalError(null);
              setModalOpen(true);
            }}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            + New QR / NFC Code
          </button>
        ) : null}
        </div>
      </div>

      <div
        className="inline-flex rounded-lg border border-slate-700 bg-slate-950/80 p-0.5"
        role="tablist"
        aria-label="QR or NFC view"
      >
        {(
          [
            ["all", "All"],
            ["qr", "QR"],
            ["nfc", "NFC"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mediumView === key}
            onClick={() => setMediumView(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              mediumView === key
                ? "bg-sky-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <QrNfcUsagePanel
        items={items}
        loading={loading}
        mediumView={mediumView}
        globalView={globalView}
        agencyId={agencyId}
        showSiteUsage={!tenantConsole}
        showLocationUsage={!tenantConsole}
      />

      {showSiteQr ? (
      <TradeShowMarketingQrPanel
        onCopied={(label) => flash("ok", `${label} copied.`)}
        onDownloaded={(fileName) => flash("ok", `${fileName} download started.`)}
        onError={(message) => flash("err", message)}
      />
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {mediumView === "nfc" ? "Program NFC tags" : "Print on your sign"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {mediumView === "nfc"
            ? "Open each location code in the Rapid Cortex mobile app, tap Program NFC Tag, hold an NTAG213 to your phone, then stick the tag behind the sign. Browser for QR PNGs; RC app for NFC write and QR verify — no other apps."
            : "Signs only need the QR code and NFC tag. When someone scans, they can tap to call or submit a report."}
        </p>
        {mediumView !== "nfc" ? (
          <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
            <li>Scan the QR code</li>
            <li>Tap this sign (NFC)</li>
          </ul>
        ) : null}
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
        {vertical === "campus" ? (
          <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {actionMsg ? (
        <p
          className={`text-sm ${actionMsg.tone === "ok" ? "text-emerald-400" : "text-rose-400"}`}
          role="status"
        >
          {actionMsg.text}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      {created ? (
        <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-4">
          <p className="font-medium text-emerald-200">Code created: {created.name}</p>
          {created.qrImageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={created.qrImageBase64} alt="QR code" className="mt-3 h-40 w-40 rounded bg-white p-2" />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadPng(created, created.qrImageBase64)}
              className="rounded border border-slate-600 px-2 py-1 text-xs"
            >
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => void onCopy("QR URL", created.url)}
              className="rounded border border-slate-600 px-2 py-1 text-xs"
            >
              Copy QR URL
            </button>
            <button
              type="button"
              onClick={() => void onCopy("NFC URL", `${created.url}?medium=nfc`)}
              className="rounded border border-slate-600 px-2 py-1 text-xs"
            >
              Copy NFC URL
            </button>
          </div>
          {created.nfcEnabled ? <NFCInstructions url={`${created.url}?medium=nfc`} /> : null}
        </section>
      ) : null}

      {!loading && visibleItems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          {mediumView === "nfc"
            ? "No NFC-enabled codes match these filters."
            : "No codes match these filters."}{" "}
          Scan and tap totals are in{" "}
          <a href="#qr-nfc-usage" className="text-sky-400 hover:text-sky-300">
            Usage
          </a>{" "}
          above.
        </p>
      ) : null}

      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {visibleItems.map((row) => {
          const nfcUrl = `${row.url}?medium=nfc`;
          const showQrActions = mediumView !== "nfc";
          const showNfcActions = mediumView !== "qr" && row.nfcEnabled;
          const busy = busyId === row.qrId;
          return (
            <li key={row.qrId} className="space-y-2 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{row.name}</p>
                  <p className="text-xs text-slate-400">
                    {row.vertical} · {row.reportType}
                    {globalView ? ` · ${row.agencyId}` : ""}
                    {row.nfcEnabled ? " · NFC on" : " · NFC off"}
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
                  {locationCamerasEnabled ? (
                    <p className="mt-1 text-xs text-slate-400">
                      {row.cameraIds?.length
                        ? `Cameras: ${row.cameraIds.map((id) => cameraLabel(id)).join(", ")}`
                        : "No cameras assigned — a scan will not open a specific camera"}
                      {row.buildingId ? ` · Building ${row.buildingId}` : ""}
                      {row.siteCode ? ` · Campus ${row.siteCode}` : ""}
                      {row.floor ? ` · Floor ${row.floor}` : ""}
                    </p>
                  ) : null}
                </div>
                {canDeactivate ? (
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={row.active}
                      disabled={busy}
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
                {showQrActions && canDownload ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDownloadPng(row)}
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Download PNG"}
                  </button>
                ) : null}
                {showQrActions ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onCopy("QR URL", row.url)}
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Copy QR URL
                  </button>
                ) : null}
                {showNfcActions ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onCopy("NFC URL", nfcUrl)}
                    className="rounded border border-sky-700 px-2 py-1 text-xs text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
                  >
                    Copy NFC URL
                  </button>
                ) : null}
                {showNfcActions ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedNfcId((id) => (id === row.qrId ? null : row.qrId))
                    }
                    className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    {expandedNfcId === row.qrId ? "Hide NFC guide" : "NFC programming"}
                  </button>
                ) : null}
                {canDeactivate && row.active ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void deactivate(row.qrId)}
                    className="rounded border border-rose-800 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                ) : null}
                {locationCamerasEnabled && canCreate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setAssigningQrId((id) => (id === row.qrId ? null : row.qrId));
                      setAssignDraft({
                        buildingId: row.buildingId ?? "",
                        floor: row.floor ?? "",
                        cameraIds: row.cameraIds ?? [],
                        siteCode: row.siteCode ?? "",
                      });
                    }}
                    className="rounded border border-sky-700 px-2 py-1 text-xs text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
                  >
                    {assigningQrId === row.qrId ? "Hide cameras" : "Assign cameras"}
                  </button>
                ) : null}
              </div>
              {expandedNfcId === row.qrId && row.nfcEnabled ? (
                <NFCInstructions url={nfcUrl} />
              ) : null}
              {assigningQrId === row.qrId && locationCamerasEnabled ? (
                <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
                  <p className="text-xs text-slate-300">
                    Cameras assigned here open live when this code is scanned.
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-slate-400">
                      Building
                      <input
                        value={assignDraft.buildingId}
                        onChange={(e) =>
                          setAssignDraft((d) => ({ ...d, buildingId: e.target.value }))
                        }
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Floor
                      <input
                        value={assignDraft.floor}
                        onChange={(e) => setAssignDraft((d) => ({ ...d, floor: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                      />
                    </label>
                    {vertical === "campus" && sites.length > 0 ? (
                      <label className="text-xs text-slate-400 sm:col-span-2">
                        Campus
                        <select
                          value={assignDraft.siteCode}
                          onChange={(e) =>
                            setAssignDraft((d) => ({ ...d, siteCode: e.target.value }))
                          }
                          className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                        >
                          <option value="">Tenant primary</option>
                          {sites.map((site) => (
                            <option key={site.code} value={site.code}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {registryCameras.length === 0 ? (
                      <p className="text-xs text-amber-300">
                        No cameras in the registry yet. Add cameras first, then assign them here.
                      </p>
                    ) : (
                      registryCameras.map((cam) => {
                        const checked = assignDraft.cameraIds.includes(cam.cameraId);
                        return (
                          <label key={cam.cameraId} className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAssignDraft((d) => ({
                                  ...d,
                                  cameraIds: checked
                                    ? d.cameraIds.filter((id) => id !== cam.cameraId)
                                    : [...d.cameraIds, cam.cameraId].slice(0, 8),
                                }))
                              }
                            />
                            {cam.displayName}
                            <span className="text-slate-500">
                              {cam.buildingId ?? cam.sections[0]}
                              {cam.floor ? ` · ${cam.floor}` : ""}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveCameraAssignment(row)}
                    className="mt-2 rounded bg-sky-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                  >
                    Save camera assignment
                  </button>
                </div>
              ) : null}
              {mediumView === "nfc" && row.nfcWriteLog && row.nfcWriteLog.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Last NFC write:{" "}
                  {new Date(row.nfcWriteLog[row.nfcWriteLog.length - 1]!.writtenAt).toLocaleString()}
                  {row.nfcWriteLog[row.nfcWriteLog.length - 1]?.writtenByName
                    ? ` by ${row.nfcWriteLog[row.nfcWriteLog.length - 1]!.writtenByName}`
                    : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={(e) => void onCreate(e)} className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-slate-100">New QR / NFC code</h3>
            <p className="mt-2 rounded border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-slate-400">
              This creates a <span className="text-slate-200">location report</span> code.
              {showSiteQr ? (
                <>
                  {" "}
                  For{" "}
                  <a href="#rc-marketing-qr" className="text-amber-300 hover:text-amber-200" onClick={() => setModalOpen(false)}>
                    www.rapidcortex.us
                  </a>{" "}
                  booth signs, close this and use <span className="text-slate-200">Rapid Cortex site QR</span>.
                </>
              ) : null}
            </p>
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
            {locationCamerasEnabled ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Building
                    <input
                      value={form.buildingId ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, buildingId: e.target.value }))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Floor
                    <input
                      value={form.floor ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
                    />
                  </label>
                  {vertical === "campus" && sites.length > 0 ? (
                    <label className="block text-sm text-slate-300 sm:col-span-2">
                      Campus
                      <select
                        value={form.siteCode ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, siteCode: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5"
                      >
                        <option value="">Tenant primary</option>
                        {sites.map((site) => (
                          <option key={site.code} value={site.code}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <fieldset className="mt-3">
                  <legend className="text-sm text-slate-300">Assigned cameras</legend>
                  <p className="mt-1 text-xs text-slate-500">
                    Required for inprocessing. When this code is scanned, operators get live video
                    from these cameras.
                  </p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-700 p-2">
                    {registryCameras.length === 0 ? (
                      <p className="text-xs text-amber-300">
                        No cameras registered yet. Create cameras first, then assign them to this
                        location.
                      </p>
                    ) : (
                      registryCameras.map((cam) => {
                        const checked = (form.cameraIds ?? []).includes(cam.cameraId);
                        return (
                          <label key={cam.cameraId} className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setForm((f) => {
                                  const current = f.cameraIds ?? [];
                                  return {
                                    ...f,
                                    cameraIds: checked
                                      ? current.filter((id) => id !== cam.cameraId)
                                      : [...current, cam.cameraId].slice(0, 8),
                                  };
                                })
                              }
                            />
                            {cam.displayName}
                            <span className="text-slate-500">
                              {cam.buildingId ?? cam.sections[0]}
                              {cam.floor ? ` · ${cam.floor}` : ""}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </fieldset>
              </>
            ) : null}
            <label className="mt-3 block text-sm text-slate-300">
              Call number (optional)
              <input
                value={form.callNumber ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, callNumber: e.target.value }))}
                placeholder="7065551234 or +17065551234"
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
            {modalError ? <p className="mt-3 text-sm text-rose-400">{modalError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={creating}
                className="rounded border border-slate-600 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
