import { describe, expect, it } from "vitest";
import { deriveSopIntelligenceCoaching } from "./coaching.js";
import { sopIntelligencePhase2Schema } from "./schemas.js";

describe("sopIntelligencePhase2Schema", () => {
  it("requires sopId and stepId when a gap is identified", () => {
    const parsed = sopIntelligencePhase2Schema.safeParse({
      callId: "BC-1",
      whatHappened: "ALI plotted to the wrong city",
      sopGapIdentified: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete phase-2 gap report", () => {
    const parsed = sopIntelligencePhase2Schema.safeParse({
      callId: "BC-2026-091604",
      dispatcherName: "T. Washington",
      telecom: "T. Washington",
      whatHappened: "Caller in Tamarac; ALI showed Plantation.",
      sopGapIdentified: true,
      sopId: "7.2",
      stepId: "7.2.1",
      gapDescription: "SOP stays with ALI instead of stated location",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("deriveSopIntelligenceCoaching", () => {
  it("groups SOP-gap reports by dispatcher and step", () => {
    const items = deriveSopIntelligenceCoaching(
      [{ sopId: "7.2", stepId: "7.2.1", sopTitle: "Location Discrepancy", gapCount: 3 }],
      [
        {
          reportId: "r1",
          dispatcherName: "T. Washington",
          sopId: "7.2",
          stepId: "7.2.1",
          callId: "BC-1",
          createdAt: "2026-09-16T12:00:00.000Z",
        },
        {
          reportId: "r2",
          dispatcherName: "T. Washington",
          sopId: "7.2",
          stepId: "7.2.1",
          callId: "BC-2",
          createdAt: "2026-09-16T13:00:00.000Z",
        },
        {
          reportId: "r3",
          dispatcherName: "T. Washington",
          sopId: "7.2",
          stepId: "7.2.1",
          callId: "BC-3",
          createdAt: "2026-09-16T14:00:00.000Z",
        },
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.priority).toBe("priority");
    expect(items[0]?.reportCount).toBe(3);
    expect(items[0]?.latestCallId).toBe("BC-3");
  });
});
