import { describe, expect, it } from "vitest";
import { DEMO_SCENARIO_CATALOG } from "rapid-cortex-shared";
import { DEMO_TRANSCRIPT_CHUNKS } from "./demo-scenarios";

describe("DEMO_TRANSCRIPT_CHUNKS", () => {
  it("has chunks for every catalog scenario including noise-complaint", () => {
    for (const row of DEMO_SCENARIO_CATALOG) {
      const chunks = DEMO_TRANSCRIPT_CHUNKS[row.id];
      expect(chunks?.length ?? 0).toBeGreaterThan(0);
    }
    expect(DEMO_TRANSCRIPT_CHUNKS["noise-complaint"]?.some((c) => /noise complaint/i.test(c.text))).toBe(
      true,
    );
  });
});
