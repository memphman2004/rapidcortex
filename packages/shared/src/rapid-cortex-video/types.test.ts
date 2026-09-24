import { describe, expect, it } from "vitest";
import {
  assertClipWindow,
  cameraStatusFromHeartbeat,
  concurrentStreamLimitForRole,
  HEARTBEAT_OFFLINE_MS,
  VIDEO_CLIP_MAX_SECONDS,
  videoRecordingStreamName,
  videoPtzPanTilt,
  videoPtzVelocity,
  videoWallCellCount,
  videoWallConfigPutBodySchema,
} from "./types.js";

describe("NexiQ Video wall types", () => {
  it("counts layout cells", () => {
    expect(videoWallCellCount("1x1")).toBe(1);
    expect(videoWallCellCount("2x2")).toBe(4);
    expect(videoWallCellCount("3x3")).toBe(9);
    expect(videoWallCellCount("4x4")).toBe(16);
    expect(videoWallCellCount("custom", 6)).toBe(6);
  });

  it("maps canonical and alias roles to stream limits", () => {
    expect(concurrentStreamLimitForRole("CAMPUS_SECURITY")).toBe(4);
    expect(concurrentStreamLimitForRole("campussecurity")).toBe(4);
    expect(concurrentStreamLimitForRole("VENUE_OPERATOR")).toBe(16);
    expect(concurrentStreamLimitForRole("venue_admin")).toBe(32);
    expect(concurrentStreamLimitForRole("rcsuperadmin")).toBe(999);
    expect(concurrentStreamLimitForRole("dispatcher")).toBe(4);
  });

  it("marks cameras offline when heartbeat is stale", () => {
    const now = Date.parse("2026-09-12T20:00:00.000Z");
    expect(
      cameraStatusFromHeartbeat("online", "2026-09-12T19:56:00.000Z", now),
    ).toBe("online");
    expect(
      cameraStatusFromHeartbeat(
        "online",
        new Date(now - HEARTBEAT_OFFLINE_MS - 1).toISOString(),
        now,
      ),
    ).toBe("offline");
  });

  it("rejects wall saves over 64 tiles", () => {
    const parsed = videoWallConfigPutBodySchema.safeParse({
      layout: "custom",
      tiles: Array.from({ length: 65 }, (_, i) => ({
        position: i,
        cameraId: `c${i}`,
        kvsChannelName: `rc-a-c${i}`,
        displayName: `Cam ${i}`,
        vendor: "onvif",
        ptzCapable: false,
        status: "unknown",
      })),
    });
    expect(parsed.success).toBe(false);
  });

  it("caps clip windows at KVS GetClip limits", () => {
    expect(assertClipWindow("2026-09-12T20:00:00.000Z", "2026-09-12T20:00:10.000Z").ok).toBe(false);
    expect(assertClipWindow("2026-09-12T20:00:00.000Z", "2026-09-12T20:01:00.000Z")).toEqual({
      ok: true,
      durationSeconds: 60,
    });
    const tooLong = assertClipWindow("2026-09-12T20:00:00.000Z", "2026-09-12T20:06:00.000Z");
    expect(tooLong).toEqual({ ok: false, code: "CLIP_TOO_LONG" });
    expect(VIDEO_CLIP_MAX_SECONDS).toBe(300);
  });

  it("names recording streams separately from live signaling channels", () => {
    expect(videoRecordingStreamName("Agency One", "cam-1")).toBe("rc-vrec-agency-one-cam-1");
  });

  it("maps PTZ speed and diagonals to ONVIF velocity", () => {
    expect(videoPtzVelocity(1)).toBe(0.1);
    expect(videoPtzVelocity(5)).toBe(0.5);
    expect(videoPtzPanTilt("up-right", 2)).toEqual({ x: 0.2, y: 0.2 });
    expect(videoPtzPanTilt("left", 5)).toEqual({ x: -0.5, y: 0 });
  });
});
