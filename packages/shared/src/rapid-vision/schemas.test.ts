import { describe, expect, it } from "vitest";
import { visionCameraSceneConfigSchema, visionSceneEventPatchSchema, visionSceneEventsQuerySchema, visionTranscriptQuerySchema, visionTranscriptSessionBodySchema } from "./schemas.js";

describe("visionTranscriptQuerySchema", () => {
  it("accepts session-scoped history with a capped limit", () => {
    const parsed = visionTranscriptQuerySchema.parse({ sessionId: "sess-1", limit: "50" });
    expect(parsed.sessionId).toBe("sess-1");
    expect(parsed.limit).toBe(50);
  });

  it("rejects oversized limits", () => {
    expect(() => visionTranscriptQuerySchema.parse({ limit: 999 })).toThrow();
  });
});

describe("visionTranscriptSessionBodySchema", () => {
  it("requires incidentId", () => {
    expect(visionTranscriptSessionBodySchema.parse({ incidentId: "inc-1" }).incidentId).toBe("inc-1");
    expect(() => visionTranscriptSessionBodySchema.parse({})).toThrow();
  });
});

describe("visionSceneEventsQuerySchema", () => {
  it("accepts status and limit", () => {
    expect(visionSceneEventsQuerySchema.parse({ status: "active", limit: "20" })).toEqual({
      status: "active",
      limit: 20,
    });
  });
});

describe("visionSceneEventPatchSchema", () => {
  it("accepts dismiss with a required-style reason", () => {
    expect(
      visionSceneEventPatchSchema.parse({ action: "dismiss", dismissReason: "false_positive" }),
    ).toEqual({ action: "dismiss", dismissReason: "false_positive" });
  });

  it("rejects unknown dismiss reasons", () => {
    expect(() =>
      visionSceneEventPatchSchema.parse({ action: "dismiss", dismissReason: "nope" }),
    ).toThrow();
  });
});

describe("visionCameraSceneConfigSchema", () => {
  it("accepts monitoring and sensitivity", () => {
    expect(
      visionCameraSceneConfigSchema.parse({
        aiMonitoringEnabled: true,
        sceneSensitivity: "high",
      }),
    ).toEqual({ aiMonitoringEnabled: true, sceneSensitivity: "high" });
  });
});
