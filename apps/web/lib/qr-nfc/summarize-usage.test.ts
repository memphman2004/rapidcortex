import { describe, expect, it } from "vitest";
import {
  combineQrWebsiteClickTotals,
  filterQrNfcByMedium,
  formatUsageWhen,
  summarizeLocationQrUsage,
  summarizeQrNfcUsage,
} from "./summarize-usage";

function code(
  partial: Partial<Parameters<typeof summarizeQrNfcUsage>[0][number]> & { qrId: string; name: string },
) {
  return {
    agencyId: "agency-a",
    vertical: "campus",
    nfcEnabled: true,
    active: true,
    scanCount: 0,
    nfcTapCount: 0,
    totalEngagements: 0,
    ...partial,
  };
}

describe("summarizeQrNfcUsage", () => {
  it("returns zeros for an empty list", () => {
    const summary = summarizeQrNfcUsage([]);
    expect(summary).toMatchObject({
      codeCount: 0,
      activeCount: 0,
      codesWithUsage: 0,
      qrScans: 0,
      nfcTaps: 0,
      totalEngagements: 0,
      ranked: [],
    });
    expect(summary.lastEngagementAt).toBeUndefined();
  });

  it("sums QR scans, NFC taps, and last activity", () => {
    const summary = summarizeQrNfcUsage([
      code({
        qrId: "a",
        name: "Gate A",
        scanCount: 10,
        nfcTapCount: 3,
        totalEngagements: 13,
        lastEngagementAt: "2026-08-20T12:00:00.000Z",
      }),
      code({
        qrId: "b",
        name: "Gate B",
        nfcEnabled: false,
        scanCount: 2,
        nfcTapCount: 0,
        totalEngagements: 2,
        lastEngagementAt: "2026-08-25T09:00:00.000Z",
      }),
      code({
        qrId: "c",
        name: "Unused",
        active: false,
      }),
    ]);
    expect(summary.qrScans).toBe(12);
    expect(summary.nfcTaps).toBe(3);
    expect(summary.totalEngagements).toBe(15);
    expect(summary.codeCount).toBe(3);
    expect(summary.activeCount).toBe(2);
    expect(summary.codesWithUsage).toBe(2);
    expect(summary.lastEngagementAt).toBe("2026-08-25T09:00:00.000Z");
    expect(summary.ranked.map((row) => row.qrId)).toEqual(["a", "b", "c"]);
  });

  it("ranks NFC-enabled codes by tap count on the NFC tab", () => {
    const items = [
      code({ qrId: "low", name: "Low taps", nfcTapCount: 1, scanCount: 90, totalEngagements: 91 }),
      code({ qrId: "high", name: "High taps", nfcTapCount: 8, scanCount: 1, totalEngagements: 9 }),
      code({ qrId: "qr-only", name: "QR only", nfcEnabled: false, scanCount: 50, totalEngagements: 50 }),
    ];
    expect(filterQrNfcByMedium(items, "nfc").map((row) => row.qrId)).toEqual(["low", "high"]);
    const summary = summarizeQrNfcUsage(items, "nfc");
    expect(summary.codeCount).toBe(2);
    expect(summary.nfcTaps).toBe(9);
    expect(summary.ranked.map((row) => row.qrId)).toEqual(["high", "low"]);
  });
});

describe("summarizeLocationQrUsage", () => {
  it("ranks location QR points by scan count", () => {
    const summary = summarizeLocationQrUsage([
      {
        rcli: "rcli-b",
        locationName: "North Gate",
        agencyId: "venue-mbs",
        zoneCode: "NG",
        vertical: "venue",
        active: true,
        scanCount: 4,
        lastScannedAt: "2026-08-24T00:00:00.000Z",
      },
      {
        rcli: "rcli-a",
        locationName: "Club Level",
        agencyId: "venue-mbs",
        zoneCode: "CL",
        vertical: "venue",
        active: true,
        scanCount: 12,
        lastScannedAt: "2026-08-25T00:00:00.000Z",
      },
    ]);
    expect(summary.qrScans).toBe(16);
    expect(summary.codesWithUsage).toBe(2);
    expect(summary.ranked.map((row) => row.rcli)).toEqual(["rcli-a", "rcli-b"]);
    expect(summary.lastScannedAt).toBe("2026-08-25T00:00:00.000Z");
  });
});

describe("formatUsageWhen", () => {
  it("returns an em dash for missing or invalid timestamps", () => {
    expect(formatUsageWhen()).toBe("—");
    expect(formatUsageWhen("not-a-date")).toBe("—");
  });
});

describe("combineQrWebsiteClickTotals", () => {
  it("sums report, site, and location QR website clicks with NFC taps", () => {
    expect(
      combineQrWebsiteClickTotals({
        reportQr: 10,
        reportNfc: 2,
        siteQr: 5,
        siteNfc: 1,
        locationQr: 3,
      }),
    ).toEqual({ qrClicks: 18, nfcTaps: 3, total: 21 });
  });
});
