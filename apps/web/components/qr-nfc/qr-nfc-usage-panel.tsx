"use client";

import { useEffect, useMemo, useState } from "react";
import type { QRLocation, TradeShowSiteUsageItem } from "rapid-cortex-shared";
import { loadLocationQrUsage } from "@/lib/qr-nfc/load-location-qr-usage";
import {
  combineQrWebsiteClickTotals,
  formatUsageCount,
  formatUsageWhen,
  QR_NFC_USAGE_TABLE_LIMIT,
  summarizeLocationQrUsage,
  summarizeQrNfcUsage,
  type QrNfcUsageItem,
  type QrNfcUsageMedium,
} from "@/lib/qr-nfc/summarize-usage";
import { isLocationsQrAdminEnabled } from "@/lib/runtime-flags";

type Props = {
  items: QrNfcUsageItem[];
  loading: boolean;
  mediumView: QrNfcUsageMedium;
  globalView: boolean;
  agencyId: string;
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function QrNfcUsagePanel({ items, loading, mediumView, globalView, agencyId }: Props) {
  const summary = useMemo(() => summarizeQrNfcUsage(items, mediumView), [items, mediumView]);
  const showLocationQr = isLocationsQrAdminEnabled() && mediumView !== "nfc";
  const [locations, setLocations] = useState<QRLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(showLocationQr);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [siteItems, setSiteItems] = useState<TradeShowSiteUsageItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/qr-nfc/site-usage", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return { items: [] as TradeShowSiteUsageItem[] };
        return (await res.json()) as { items?: TradeShowSiteUsageItem[] };
      })
      .then((body) => {
        if (!cancelled) setSiteItems(Array.isArray(body.items) ? body.items : []);
      })
      .catch(() => {
        if (!cancelled) setSiteItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showLocationQr) {
      setLocations([]);
      setLocationsLoading(false);
      setLocationsError(null);
      return;
    }
    let cancelled = false;
    setLocationsLoading(true);
    setLocationsError(null);
    void loadLocationQrUsage({ globalView, agencyId })
      .then((result) => {
        if (cancelled) return;
        setLocations(result.locations);
        setLocationsError(result.error ?? null);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId, globalView, showLocationQr]);

  const locationSummary = useMemo(() => summarizeLocationQrUsage(locations), [locations]);
  const siteSummary = useMemo(() => {
    return siteItems.reduce(
      (acc, row) => ({
        qrScans: acc.qrScans + (row.scanCount || 0),
        nfcTaps: acc.nfcTaps + (row.nfcTapCount || 0),
        lastEngagementAt:
          row.lastEngagementAt && (!acc.lastEngagementAt || row.lastEngagementAt > acc.lastEngagementAt)
            ? row.lastEngagementAt
            : acc.lastEngagementAt,
      }),
      { qrScans: 0, nfcTaps: 0, lastEngagementAt: undefined as string | undefined },
    );
  }, [siteItems]);
  const combined = useMemo(
    () =>
      combineQrWebsiteClickTotals({
        reportQr: mediumView === "nfc" ? 0 : summary.qrScans,
        reportNfc: mediumView === "qr" ? 0 : summary.nfcTaps,
        siteQr: mediumView === "nfc" ? 0 : siteSummary.qrScans,
        siteNfc: mediumView === "qr" ? 0 : siteSummary.nfcTaps,
        locationQr: showLocationQr ? locationSummary.qrScans : 0,
      }),
    [locationSummary.qrScans, mediumView, showLocationQr, siteSummary, summary],
  );
  const siteCodesWithUsage = siteItems.filter(
    (row) => (row.scanCount || 0) + (row.nfcTapCount || 0) + (row.totalEngagements || 0) > 0,
  ).length;
  const lastAny = [summary.lastEngagementAt, siteSummary.lastEngagementAt, locationSummary.lastScannedAt]
    .filter((iso): iso is string => Boolean(iso))
    .sort()
    .at(-1);
  const reportOverflow = summary.codeCount > QR_NFC_USAGE_TABLE_LIMIT;
  const locationOverflow = locationSummary.codeCount > QR_NFC_USAGE_TABLE_LIMIT;
  const reportColSpan =
    3 + (globalView ? 1 : 0) + (mediumView !== "nfc" ? 1 : 0) + (mediumView !== "qr" ? 1 : 0);

  return (
    <section
      id="qr-nfc-usage"
      className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Usage</h3>
        <p className="mt-1 text-xs text-slate-500">
          Counts every QR-initiated website open: location report codes, Location QR (RCLI) scan
          points, and Rapid Cortex site signs (www.rapidcortex.us). NFC taps are counted separately
          when a programmed tag opens the same pages. Re-download the site QR (or reprogram the
          booth tag) so new scans use the tracked link.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading usage…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mediumView !== "nfc" ? (
              <StatCard
                label="QR website clicks"
                value={formatUsageCount(combined.qrClicks)}
                hint="Report + site + RCLI"
              />
            ) : null}
            {mediumView !== "qr" ? (
              <StatCard
                label="NFC taps"
                value={formatUsageCount(combined.nfcTaps)}
                hint={
                  mediumView === "nfc"
                    ? `${formatUsageCount(summary.codeCount)} NFC-enabled report codes`
                    : "Report + site signs"
                }
              />
            ) : null}
            <StatCard
              label="Total engagements"
              value={formatUsageCount(combined.total)}
              hint={lastAny ? `Last ${formatUsageWhen(lastAny)}` : "No activity yet"}
            />
            <StatCard
              label="Codes with activity"
              value={formatUsageCount(
                summary.codesWithUsage + siteCodesWithUsage + locationSummary.codesWithUsage,
              )}
              hint={`${formatUsageCount(summary.activeCount)} active report codes`}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
              Rapid Cortex site QR
            </h4>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-3 font-medium">Destination</th>
                  {mediumView !== "nfc" ? <th className="py-1 pr-3 font-medium">QR clicks</th> : null}
                  {mediumView !== "qr" ? <th className="py-1 pr-3 font-medium">NFC taps</th> : null}
                  <th className="py-1 font-medium">Last used</th>
                </tr>
              </thead>
              <tbody>
                {(siteItems.length
                  ? siteItems
                  : [
                      {
                        qrId: "site-home" as const,
                        destinationId: "home" as const,
                        name: "Rapid Cortex site — Home",
                        url: "https://www.rapidcortex.us",
                        scanCount: 0,
                        nfcTapCount: 0,
                        totalEngagements: 0,
                      },
                      {
                        qrId: "site-demo" as const,
                        destinationId: "demo" as const,
                        name: "Rapid Cortex site — Demo",
                        url: "https://www.rapidcortex.us/demo/",
                        scanCount: 0,
                        nfcTapCount: 0,
                        totalEngagements: 0,
                      },
                    ]
                ).map((row) => (
                  <tr key={row.qrId} className="text-slate-200">
                    <td className="py-1.5 pr-3">
                      <p className="font-medium text-slate-100">{row.name}</p>
                      <p className="text-[11px] text-slate-500">{row.url.replace(/^https:\/\//, "")}</p>
                    </td>
                    {mediumView !== "nfc" ? (
                      <td className="py-1.5 pr-3 tabular-nums">{formatUsageCount(row.scanCount)}</td>
                    ) : null}
                    {mediumView !== "qr" ? (
                      <td className="py-1.5 pr-3 tabular-nums">{formatUsageCount(row.nfcTapCount)}</td>
                    ) : null}
                    <td className="py-1.5 text-xs text-slate-400">{formatUsageWhen(row.lastEngagementAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Report code scan and NFC tap counts</caption>
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Code</th>
                  {globalView ? <th className="py-2 pr-3 font-medium">Agency</th> : null}
                  {mediumView !== "nfc" ? <th className="py-2 pr-3 font-medium">QR scans</th> : null}
                  {mediumView !== "qr" ? <th className="py-2 pr-3 font-medium">NFC taps</th> : null}
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 font-medium">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {summary.ranked.length === 0 ? (
                  <tr>
                    <td
                      colSpan={reportColSpan}
                      className="py-6 text-center text-xs text-slate-500"
                    >
                      No report codes to count yet. Usage appears after a posted QR is scanned or an NFC
                      tag is tapped.
                    </td>
                  </tr>
                ) : (
                  summary.ranked.map((row) => (
                    <tr key={row.qrId} className="text-slate-200">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-100">{row.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {row.vertical}
                          {row.nfcEnabled ? " · NFC on" : " · NFC off"}
                          {row.active ? "" : " · inactive"}
                        </p>
                      </td>
                      {globalView ? (
                        <td className="py-2 pr-3 font-mono text-xs text-slate-400">{row.agencyId}</td>
                      ) : null}
                      {mediumView !== "nfc" ? (
                        <td className="py-2 pr-3 tabular-nums">{formatUsageCount(row.scanCount)}</td>
                      ) : null}
                      {mediumView !== "qr" ? (
                        <td className="py-2 pr-3 tabular-nums">{formatUsageCount(row.nfcTapCount)}</td>
                      ) : null}
                      <td className="py-2 pr-3 tabular-nums">{formatUsageCount(row.totalEngagements)}</td>
                      <td className="py-2 text-xs text-slate-400">{formatUsageWhen(row.lastEngagementAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {reportOverflow ? (
              <p className="mt-2 text-[11px] text-slate-500">
                Showing the {QR_NFC_USAGE_TABLE_LIMIT} most-used report codes.
              </p>
            ) : null}
          </div>
        </>
      )}

      {showLocationQr ? (
        <div className="border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Location QR (RCLI)
            </h4>
            {globalView ? (
              <a
                href="/rc-admin/location-qr-codes"
                className="text-xs text-sky-400 hover:text-sky-300"
              >
                Open Location QR →
              </a>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Scan points created under Location QR. These track QR scans only — they do not have a separate
            NFC tap counter.
          </p>
          {locationsLoading ? (
            <p className="mt-3 text-sm text-slate-400">Loading location QR scans…</p>
          ) : locationsError ? (
            <p className="mt-3 text-sm text-amber-300">{locationsError}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <StatCard
                  label="RCLI scans"
                  value={formatUsageCount(locationSummary.qrScans)}
                  hint={
                    locationSummary.lastScannedAt
                      ? `Last ${formatUsageWhen(locationSummary.lastScannedAt)}`
                      : "No scans yet"
                  }
                />
                <StatCard
                  label="Locations with scans"
                  value={formatUsageCount(locationSummary.codesWithUsage)}
                  hint={`${formatUsageCount(locationSummary.codeCount)} locations`}
                />
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">Location QR scan counts</caption>
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-medium">Location</th>
                      {globalView ? <th className="py-2 pr-3 font-medium">Agency</th> : null}
                      <th className="py-2 pr-3 font-medium">Zone</th>
                      <th className="py-2 pr-3 font-medium">Scans</th>
                      <th className="py-2 font-medium">Last scanned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {locationSummary.ranked.length === 0 ? (
                      <tr>
                        <td
                          colSpan={globalView ? 5 : 4}
                          className="py-6 text-center text-xs text-slate-500"
                        >
                          No Location QR scan points found for the selected tenant(s).
                        </td>
                      </tr>
                    ) : (
                      locationSummary.ranked.map((row) => (
                        <tr key={`${row.agencyId}:${row.rcli}`} className="text-slate-200">
                          <td className="py-2 pr-3">
                            <p className="font-medium text-slate-100">{row.locationName}</p>
                            <p className="font-mono text-[11px] text-slate-500">{row.rcli}</p>
                          </td>
                          {globalView ? (
                            <td className="py-2 pr-3 font-mono text-xs text-slate-400">{row.agencyId}</td>
                          ) : null}
                          <td className="py-2 pr-3 text-xs text-slate-300">{row.zoneCode}</td>
                          <td className="py-2 pr-3 tabular-nums">{formatUsageCount(row.scanCount)}</td>
                          <td className="py-2 text-xs text-slate-400">
                            {formatUsageWhen(row.lastScannedAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {locationOverflow ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Showing the {QR_NFC_USAGE_TABLE_LIMIT} most-scanned locations.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
