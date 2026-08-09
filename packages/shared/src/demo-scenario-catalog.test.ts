import { describe, expect, it } from "vitest";
import { DEMO_SCENARIO_CATALOG } from "./demo-scenario-catalog.js";

describe("DEMO_SCENARIO_CATALOG", () => {
  it("lists pilot scenarios with unique ids including noise-complaint", () => {
    expect(DEMO_SCENARIO_CATALOG.length).toBe(7);
    const ids = new Set(DEMO_SCENARIO_CATALOG.map((s) => s.id));
    expect(ids.size).toBe(DEMO_SCENARIO_CATALOG.length);
    expect(ids.has("noise-complaint")).toBe(true);
  });
});
