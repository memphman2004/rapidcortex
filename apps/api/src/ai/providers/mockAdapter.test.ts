import { describe, expect, it } from "vitest";
import { incidentPictureFactsBrief } from "rapid-cortex-shared";
import { MockAdapter } from "./mockAdapter.js";

const shots = {
  title: "Shots Fired — Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  callerAddressLine: "Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  cadLocation: "Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  cadNatureCode: "SHOTS",
  category: "police" as const,
};

describe("mock triage", () => {
  const adapter = new MockAdapter();

  it("treats a shots-fired incident record as a police call", async () => {
    const result = (await adapter.analyze({
      incidentId: "inc-1",
      agencyId: "test-agency",
      transcript: [],
      incidentBrief: incidentPictureFactsBrief(shots),
    })) as { category: string; rationale: string };
    expect(result.category).toBe("police");
    expect(result.rationale).not.toMatch(/Insufficient signal/);
  });

  it("still classifies smoke as fire", async () => {
    const result = (await adapter.analyze({
      incidentId: "inc-2",
      agencyId: "test-agency",
      transcript: [
        {
          segmentId: "s1",
          incidentId: "inc-2",
          agencyId: "test-agency",
          speaker: "caller",
          text: "I see smoke coming from the kitchen",
          timestamp: "2026-10-30T00:00:00.000Z",
        },
      ],
    })) as { category: string };
    expect(result.category).toBe("fire");
  });
});
