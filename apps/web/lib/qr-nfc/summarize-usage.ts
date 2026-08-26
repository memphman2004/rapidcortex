export type QrNfcUsageMedium = "all" | "qr" | "nfc";

export type QrNfcUsageItem = {
  qrId: string;
  name: string;
  agencyId: string;
  vertical: string;
  nfcEnabled: boolean;
  active: boolean;
  scanCount: number;
  nfcTapCount: number;
  totalEngagements: number;
  lastEngagementAt?: string;
};

export type LocationQrUsageItem = {
  rcli: string;
  locationName: string;
  agencyId: string;
  zoneCode: string;
  vertical: string;
  active: boolean;
  scanCount: number;
  lastScannedAt?: string;
};

export type QrNfcUsageSummary = {
  codeCount: number;
  activeCount: number;
  codesWithUsage: number;
  qrScans: number;
  nfcTaps: number;
  totalEngagements: number;
  lastEngagementAt?: string;
  ranked: QrNfcUsageItem[];
};

export type LocationQrUsageSummary = {
  codeCount: number;
  codesWithUsage: number;
  qrScans: number;
  lastScannedAt?: string;
  ranked: LocationQrUsageItem[];
};

const USAGE_TABLE_LIMIT = 25;

function laterIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isNaN(aMs)) return Number.isNaN(bMs) ? a : b;
  if (Number.isNaN(bMs)) return a;
  return bMs > aMs ? b : a;
}

function n(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

/** Filter report codes by the QR / NFC / All tab. */
export function filterQrNfcByMedium(
  items: readonly QrNfcUsageItem[],
  medium: QrNfcUsageMedium,
): QrNfcUsageItem[] {
  if (medium === "nfc") return items.filter((row) => row.nfcEnabled);
  return [...items];
}

function sortQrNfc(items: QrNfcUsageItem[], medium: QrNfcUsageMedium): QrNfcUsageItem[] {
  return [...items].sort((a, b) => {
    const metric =
      medium === "nfc"
        ? n(b.nfcTapCount) - n(a.nfcTapCount)
        : medium === "qr"
          ? n(b.scanCount) - n(a.scanCount)
          : n(b.totalEngagements) - n(a.totalEngagements);
    if (metric !== 0) return metric;
    const last = Date.parse(b.lastEngagementAt ?? "") - Date.parse(a.lastEngagementAt ?? "");
    if (!Number.isNaN(last) && last !== 0) return last;
    return a.name.localeCompare(b.name);
  });
}

export function summarizeQrNfcUsage(
  items: readonly QrNfcUsageItem[],
  medium: QrNfcUsageMedium = "all",
): QrNfcUsageSummary {
  const scoped = filterQrNfcByMedium(items, medium);
  let qrScans = 0;
  let nfcTaps = 0;
  let totalEngagements = 0;
  let activeCount = 0;
  let codesWithUsage = 0;
  let lastEngagementAt: string | undefined;
  for (const row of scoped) {
    qrScans += n(row.scanCount);
    nfcTaps += n(row.nfcTapCount);
    totalEngagements += n(row.totalEngagements);
    if (row.active) activeCount += 1;
    if (n(row.totalEngagements) > 0 || n(row.scanCount) > 0 || n(row.nfcTapCount) > 0) {
      codesWithUsage += 1;
    }
    lastEngagementAt = laterIso(lastEngagementAt, row.lastEngagementAt);
  }
  return {
    codeCount: scoped.length,
    activeCount,
    codesWithUsage,
    qrScans,
    nfcTaps,
    totalEngagements,
    lastEngagementAt,
    ranked: sortQrNfc(scoped, medium).slice(0, USAGE_TABLE_LIMIT),
  };
}

export function summarizeLocationQrUsage(
  items: readonly LocationQrUsageItem[],
): LocationQrUsageSummary {
  let qrScans = 0;
  let codesWithUsage = 0;
  let lastScannedAt: string | undefined;
  for (const row of items) {
    qrScans += n(row.scanCount);
    if (n(row.scanCount) > 0) codesWithUsage += 1;
    lastScannedAt = laterIso(lastScannedAt, row.lastScannedAt);
  }
  const ranked = [...items]
    .sort((a, b) => {
      const metric = n(b.scanCount) - n(a.scanCount);
      if (metric !== 0) return metric;
      return a.locationName.localeCompare(b.locationName);
    })
    .slice(0, USAGE_TABLE_LIMIT);
  return {
    codeCount: items.length,
    codesWithUsage,
    qrScans,
    lastScannedAt,
    ranked,
  };
}

export const QR_NFC_USAGE_TABLE_LIMIT = USAGE_TABLE_LIMIT;

export function formatUsageCount(value: number): string {
  return n(value).toLocaleString();
}

export function formatUsageWhen(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleString();
}

/** All QR-initiated website opens (report codes + site QR + RCLI) plus NFC taps. */
export function combineQrWebsiteClickTotals(parts: {
  reportQr: number;
  reportNfc: number;
  siteQr: number;
  siteNfc: number;
  locationQr: number;
}): { qrClicks: number; nfcTaps: number; total: number } {
  const qrClicks = n(parts.reportQr) + n(parts.siteQr) + n(parts.locationQr);
  const nfcTaps = n(parts.reportNfc) + n(parts.siteNfc);
  return { qrClicks, nfcTaps, total: qrClicks + nfcTaps };
}
