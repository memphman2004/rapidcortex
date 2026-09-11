import { describe, expect, it } from "vitest";
import { visionTranscriptQuerySchema, visionTranscriptSessionBodySchema } from "./schemas.js";

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
