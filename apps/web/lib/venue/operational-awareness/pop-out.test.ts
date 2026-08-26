import { describe, expect, it } from "vitest";
import { operationalMapPopoutPath } from "./pop-out";

describe("operational map pop-out routes", () => {
  it("builds dedicated area and facility window paths", () => {
    expect(operationalMapPopoutPath("MBS", "area")).toBe("/venue/MBS/operations/area-map");
    expect(operationalMapPopoutPath("MBS", "facility", "INC-DEMO-001")).toBe(
      "/venue/MBS/operations/facility-map?incident=INC-DEMO-001",
    );
  });
});
