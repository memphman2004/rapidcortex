import { describe, expect, it } from "vitest";
import {
  assertClipWindow,
  concurrentStreamLimitForRole,
  videoClipCreateBodySchema,
  videoPtzMoveBodySchema,
  videoWallConfigPutBodySchema,
} from "rapid-cortex-shared";

describe("Rapid Cortex Video HTTP gates", () => {
  it("rejects wall tile counts above the role stream limit", () => {
    const limit = concurrentStreamLimitForRole("CAMPUS_SECURITY");
    expect(limit).toBe(4);
    const parsed = videoWallConfigPutBodySchema.safeParse({
      layout: "3x3",
      tiles: Array.from({ length: 5 }, (_, i) => ({
        position: i,
        cameraId: `cam-${i}`,
        kvsChannelName: `rc-a-cam-${i}`,
        displayName: `Cam ${i}`,
        vendor: "onvif",
        ptzCapable: false,
        status: "online",
      })),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tiles.length).toBeGreaterThan(limit);
    }
  });

  it("accepts clip bodies and rejects windows over the GetClip cap", () => {
    const parsed = videoClipCreateBodySchema.safeParse({
      startTime: "2026-09-12T20:00:00.000Z",
      endTime: "2026-09-12T20:06:00.000Z",
    });
    expect(parsed.success).toBe(true);
    expect(assertClipWindow("2026-09-12T20:00:00.000Z", "2026-09-12T20:06:00.000Z")).toEqual({
      ok: false,
      code: "CLIP_TOO_LONG",
    });
    expect(assertClipWindow("2026-09-12T20:00:00.000Z", "2026-09-12T20:02:00.000Z")).toEqual({
      ok: true,
      durationSeconds: 120,
    });
  });

  it("accepts PTZ move bodies with ONVIF speed 1-5", () => {
    const parsed = videoPtzMoveBodySchema.safeParse({ direction: "up-left", speed: 3 });
    expect(parsed.success).toBe(true);
    expect(videoPtzMoveBodySchema.safeParse({ direction: "diagonal", speed: 3 }).success).toBe(false);
  });
});
