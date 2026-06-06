import { describe, expect, it } from "vitest";
import { DEMO_SCENARIO_CATALOG } from "./demo-scenario-catalog.js";

describe("DEMO_SCENARIO_CATALOG", () => {
  it("lists six pilot scenarios with unique ids", () => {
    expect(DEMO_SCENARIO_CATALOG.length).toBe(6);
    const ids = new Set(DEMO_SCENARIO_CATALOG.map((s) => s.id));
    expect(ids.size).toBe(DEMO_SCENARIO_CATALOG.length);
  });
});
