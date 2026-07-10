import { describe, expect, it } from "vitest";
import { sopProtocolDisplayLabel, sopProtocolLabel } from "./protocol-labels";

describe("sopProtocolLabel", () => {
  it("maps known protocol keys", () => {
    expect(sopProtocolLabel("default.welfare_check_v1")).toBe("Welfare Check");
  });

  it("title-cases unknown keys with version stripped", () => {
    expect(sopProtocolLabel("default.shots_fired_v2")).toBe("Shots Fired");
  });
});

describe("sopProtocolDisplayLabel", () => {
  it("prefers human API label when present", () => {
    expect(
      sopProtocolDisplayLabel("Welfare check — access and safety", "default.welfare_check_v1"),
    ).toBe("Welfare check — access and safety");
  });

  it("resolves raw key stored as incidentTypeLabel", () => {
    expect(sopProtocolDisplayLabel("default.welfare_check_v1", null)).toBe("Welfare Check");
  });

  it("resolves from pack id when label is Unknown", () => {
    expect(sopProtocolDisplayLabel("Unknown", "default.welfare_check_v1")).toBe("Welfare Check");
  });
});
