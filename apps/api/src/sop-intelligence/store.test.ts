import { describe, expect, it } from "vitest";
import { nextPatternRecord } from "./pattern-counter.js";

describe("nextPatternRecord", () => {
  it("creates a counter at 1 then increments on the next write", () => {
    const first = nextPatternRecord(
      null,
      {
        agencyId: "ag-1",
        sopId: "7.2",
        stepId: "7.2.1",
        sopTitle: "Location",
        reportId: "r1",
      },
      "t1",
    );
    expect(first.gapCount).toBe(1);
    const second = nextPatternRecord(
      first,
      {
        agencyId: "ag-1",
        sopId: "7.2",
        stepId: "7.2.1",
        sopTitle: "Location",
        reportId: "r2",
      },
      "t2",
    );
    expect(second.gapCount).toBe(2);
    expect(second.reportIds).toEqual(["r1", "r2"]);
    expect(second.suggestionGenerated).toBe(false);
  });
});
