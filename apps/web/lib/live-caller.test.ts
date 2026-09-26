import { describe, expect, it } from "vitest";
import {
  buildLiveCallerHoverHTML,
  callerLocationToLiveCaller,
  collectLiveCallers,
  formatLiveCallerAge,
  isLiveCallerSource,
  liveCallerFreshness,
  liveCallersToAccuracyCollection,
  liveCallersToPointCollection,
  liveCallersToTrailCollection,
  mergeLiveCallers,
  pinpointDetailToLiveCaller,
  resolveLiveCaller,
  type RCLiveCaller,
} from "./live-caller";
import type { PinpointLinkDispatcherDetail } from "rapid-cortex-shared";

const NOW = Date.parse("2026-09-20T16:00:00.000Z");

function caller(partial: Partial<RCLiveCaller> = {}): RCLiveCaller {
  return {
    id: "c1",
    lat: 33.749,
    lng: -84.388,
    updatedAt: "2026-09-20T15:59:50.000Z",
    source: "pinpoint",
    ...partial,
  };
}

describe("isLiveCallerSource", () => {
  it("treats gps/sms/pinpoint as live GPS", () => {
    expect(isLiveCallerSource("gps")).toBe(true);
    expect(isLiveCallerSource("sms")).toBe(true);
    expect(isLiveCallerSource("pinpoint")).toBe(true);
    expect(isLiveCallerSource("manual")).toBe(false);
    expect(isLiveCallerSource("qr")).toBe(false);
  });
});

describe("liveCallerFreshness", () => {
  it("is live within 15s, stale to 60s, lost after", () => {
    expect(liveCallerFreshness("2026-09-20T15:59:50.000Z", NOW)).toBe("live");
    expect(liveCallerFreshness("2026-09-20T15:59:30.000Z", NOW)).toBe("stale");
    expect(liveCallerFreshness("2026-09-20T15:58:50.000Z", NOW)).toBe("lost");
  });

  it("treats invalid timestamps as lost", () => {
    expect(liveCallerFreshness("not-a-date", NOW)).toBe("lost");
  });
});

describe("formatLiveCallerAge", () => {
  it("formats seconds then minutes", () => {
    expect(formatLiveCallerAge(2_000)).toBe("just now");
    expect(formatLiveCallerAge(12_000)).toBe("12s ago");
    expect(formatLiveCallerAge(125_000)).toBe("2m ago");
  });
});

describe("resolveLiveCaller", () => {
  it("marks high confidence and movement from speed/heading", () => {
    const resolved = resolveLiveCaller(
      caller({
        accuracyMeters: 12,
        headingDeg: 90,
        speedMps: 4,
      }),
      NOW,
    );
    expect(resolved.freshness).toBe("live");
    expect(resolved.confidence).toBe("high");
    expect(resolved.moving).toBe(true);
    expect(resolved.headingLabel).toBe("E");
    expect(resolved.speedMph).toBeGreaterThan(8);
  });
});

describe("mergeLiveCallers", () => {
  it("drops closed sessions and keeps the newest ping per id", () => {
    const merged = mergeLiveCallers([
      caller({ id: "a", updatedAt: "2026-09-20T15:59:00.000Z", lat: 1 }),
      caller({ id: "a", updatedAt: "2026-09-20T15:59:40.000Z", lat: 2 }),
      caller({ id: "b", sessionClosed: true }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.lat).toBe(2);
  });
});

describe("callerLocationToLiveCaller", () => {
  it("ignores CAD/report pins", () => {
    expect(callerLocationToLiveCaller({ lat: 1, lng: 2, source: "manual" })).toBeNull();
  });

  it("maps GPS caller pins", () => {
    const live = callerLocationToLiveCaller({
      lat: 33.7,
      lng: -84.4,
      source: "gps",
      incidentId: "inc-1",
      accuracyMeters: 20,
      updatedAt: "2026-09-20T15:59:55.000Z",
    });
    expect(live?.id).toBe("inc-1");
    expect(live?.accuracyMeters).toBe(20);
  });
});

describe("collectLiveCallers", () => {
  it("fills missing updatedAt via fallback without resetting on the same coords", () => {
    const seen = new Map<string, string>();
    const fallback = (id: string, coordKey: string) => {
      const key = `${id}:${coordKey}`;
      const existing = seen.get(key);
      if (existing) return existing;
      seen.set(key, "2026-09-20T15:59:58.000Z");
      return "2026-09-20T15:59:58.000Z";
    };
    const first = collectLiveCallers(
      [],
      { lat: 33.1, lng: -84.1, source: "sms" },
      fallback,
    );
    const second = collectLiveCallers(
      [],
      { lat: 33.1, lng: -84.1, source: "sms" },
      fallback,
    );
    expect(first[0]?.updatedAt).toBe("2026-09-20T15:59:58.000Z");
    expect(second[0]?.updatedAt).toBe(first[0]?.updatedAt);
  });
});

describe("live caller GeoJSON", () => {
  it("emits [lng, lat] points and accuracy polygons", () => {
    const resolved = resolveLiveCaller(
      caller({ accuracyMeters: 40, trail: [{ lat: 33.748, lng: -84.389 }, { lat: 33.749, lng: -84.388 }] }),
      NOW,
    );
    const points = liveCallersToPointCollection([resolved]);
    expect(points.features[0]?.geometry.coordinates).toEqual([-84.388, 33.749]);
    expect(points.features[0]?.properties?.freshness).toBe("live");

    const accuracy = liveCallersToAccuracyCollection([resolved]);
    expect(accuracy.features[0]?.geometry.type).toBe("Polygon");

    const trail = liveCallersToTrailCollection([resolved]);
    expect(trail.features[0]?.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildLiveCallerHoverHTML", () => {
  it("shows status, accuracy, disclaimer, and escapes ids", () => {
    const html = buildLiveCallerHoverHTML(
      resolveLiveCaller(
        caller({
          incidentId: "<script>x</script>",
          callId: "CAD-99",
          accuracyMeters: 18,
          label: "Caller GPS",
        }),
        NOW,
      ),
    );
    expect(html).toContain("LIVE CALLER LOCATION");
    expect(html).toContain("LIVE");
    expect(html).toContain("±18 m");
    expect(html).toContain("CAD-99");
    expect(html).not.toContain("<script>");
    expect(html).toContain("does not replace CAD/NG911 location");
  });
});

describe("pinpointDetailToLiveCaller", () => {
  it("maps the latest ping and flags revoked sessions closed", () => {
    const detail = {
      linkId: "lnk-1",
      incidentId: "inc-9",
      agencyId: "ag-1",
      status: "revoked",
      createdAt: "2026-09-20T15:00:00.000Z",
      expiresAt: "2026-09-20T16:00:00.000Z",
      pings: [
        { capturedAt: "2026-09-20T15:50:00.000Z", lat: 33.7, lng: -84.4, accuracyM: 40 },
        {
          capturedAt: "2026-09-20T15:59:50.000Z",
          lat: 33.71,
          lng: -84.41,
          accuracyM: 12,
          headingDeg: 45,
          speedMps: 3,
        },
      ],
    } as PinpointLinkDispatcherDetail;

    const converted = pinpointDetailToLiveCaller(detail);
    expect(converted?.id).toBe("pinpoint:lnk-1");
    expect(converted?.lat).toBe(33.71);
    expect(converted?.accuracyMeters).toBe(12);
    expect(converted?.sessionClosed).toBe(true);
    expect(converted?.trail).toHaveLength(2);
  });

  it("returns null when there are no pings yet", () => {
    expect(
      pinpointDetailToLiveCaller({
        linkId: "lnk-1",
        incidentId: "inc-9",
        agencyId: "ag-1",
        status: "active",
        createdAt: "2026-09-20T15:00:00.000Z",
        expiresAt: "2026-09-20T16:00:00.000Z",
        pings: [],
      } as PinpointLinkDispatcherDetail),
    ).toBeNull();
  });
});
