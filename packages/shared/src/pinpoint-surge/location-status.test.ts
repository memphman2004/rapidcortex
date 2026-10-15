import { describe, expect, it } from "vitest";
import {
  formatLocationUpdateAge,
  resolvePinpointIqLocationStatus,
} from "./location-status.js";

const NOW = Date.parse("2026-10-14T12:00:00.000Z");

describe("resolvePinpointIqLocationStatus", () => {
  it("returns SCAN ONLY only when a scan location exists and no live session", () => {
    const withScan = resolvePinpointIqLocationStatus({
      hasTrackingSession: false,
      hasScanLocation: true,
      nowMs: NOW,
    });
    expect(withScan.status).toBe("scan_only");
    expect(withScan.label).toBe("SCAN ONLY");
    expect(withScan.locationConsent).toBe(false);

    const withoutScan = resolvePinpointIqLocationStatus({
      hasTrackingSession: false,
      hasScanLocation: false,
      nowMs: NOW,
    });
    expect(withoutScan.status).toBe("location_unavailable");
  });

  it("returns LOCATION UNAVAILABLE when consented but no GPS yet", () => {
    const v = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: "2026-10-14T11:59:00.000Z",
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [],
      nowMs: NOW,
    });
    expect(v.status).toBe("location_unavailable");
    expect(v.trackingSessionActive).toBe(true);
    expect(v.locationConsent).toBe(true);
  });

  it("does not claim consent for an active SMS session before the first GPS share", () => {
    const v = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: null,
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [],
      nowMs: NOW,
    });
    expect(v.status).toBe("location_unavailable");
    expect(v.locationConsent).toBe(false);
  });

  it("returns LIVE when a fresh ping arrives", () => {
    const v = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: "2026-10-14T11:59:00.000Z",
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [
        {
          capturedAt: "2026-10-14T11:59:52.000Z",
          lat: 39.16,
          lng: -86.52,
          accuracyM: 12,
        },
      ],
      nowMs: NOW,
      freshnessSeconds: 30,
    });
    expect(v.status).toBe("live");
    expect(v.locationAccuracyMeters).toBe(12);
    expect(v.lastKnownLocation).toEqual({ lat: 39.16, lng: -86.52 });
  });

  it("returns STALE when updates fall outside freshness", () => {
    const v = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: "2026-10-14T11:50:00.000Z",
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [
        {
          capturedAt: "2026-10-14T11:58:00.000Z",
          lat: 39.16,
          lng: -86.52,
          accuracyM: 20,
        },
      ],
      nowMs: NOW,
      freshnessSeconds: 30,
    });
    expect(v.status).toBe("stale");
  });

  it("returns SHARING STOPPED when revoked or expired and never LIVE", () => {
    const revoked = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "revoked",
      hasScanLocation: true,
      consentGrantedAt: "2026-10-14T11:50:00.000Z",
      pings: [{ capturedAt: "2026-10-14T11:59:50.000Z", lat: 1, lng: 2 }],
      nowMs: NOW,
    });
    expect(revoked.status).toBe("sharing_stopped");

    const expired = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      expiresAt: "2026-10-14T11:00:00.000Z",
      consentGrantedAt: "2026-10-14T10:00:00.000Z",
      pings: [{ capturedAt: "2026-10-14T10:59:00.000Z", lat: 1, lng: 2 }],
      nowMs: NOW,
    });
    expect(expired.status).toBe("sharing_stopped");
  });

  it("does not return LIVE from a stale session without a new ping", () => {
    const mid = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: "2026-10-14T11:50:00.000Z",
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [{ capturedAt: "2026-10-14T11:58:00.000Z", lat: 1, lng: 2 }],
      nowMs: NOW,
      freshnessSeconds: 30,
    });
    expect(mid.status).toBe("stale");
    const resumed = resolvePinpointIqLocationStatus({
      hasTrackingSession: true,
      sessionStatus: "active",
      consentGrantedAt: "2026-10-14T11:50:00.000Z",
      expiresAt: "2026-10-14T12:30:00.000Z",
      pings: [
        { capturedAt: "2026-10-14T11:58:00.000Z", lat: 1, lng: 2 },
        { capturedAt: "2026-10-14T11:59:55.000Z", lat: 1.001, lng: 2.001 },
      ],
      nowMs: NOW,
      freshnessSeconds: 30,
    });
    expect(resumed.status).toBe("live");
  });

  it("prefers SCAN ONLY over unavailable when QR-only and no session", () => {
    const v = resolvePinpointIqLocationStatus({
      hasTrackingSession: false,
      hasScanLocation: true,
      pings: [],
      nowMs: NOW,
    });
    expect(v.status).toBe("scan_only");
  });
});

describe("formatLocationUpdateAge", () => {
  it("formats seconds and minutes", () => {
    expect(formatLocationUpdateAge("2026-10-14T11:59:52.000Z", NOW)).toBe("8 seconds ago");
    expect(formatLocationUpdateAge("2026-10-14T11:56:00.000Z", NOW)).toBe("4 minutes ago");
  });
});
