import { describe, expect, it } from "vitest";
import {
  agencySatisfiesAddonFamily,
  hasFamilyMatch,
  parseClaimAddons,
} from "./requireAddon.js";

describe("requireAddon helpers", () => {
  it("parses claim CSV", () => {
    expect(parseClaimAddons("ai.triage.basic, reliability.slo_dashboards")).toEqual([
      "ai.triage.basic",
      "reliability.slo_dashboards",
    ]);
    expect(parseClaimAddons(undefined)).toEqual([]);
  });

  it("matches family prefixes from claim keys", () => {
    expect(hasFamilyMatch(["ai.triage.basic"], "ai.")).toBe(true);
    expect(hasFamilyMatch(["translation.live.tier1"], "translation.")).toBe(true);
    expect(hasFamilyMatch(["reliability.slo_dashboards"], "ai.")).toBe(false);
  });

  it("honors plan-included SKUs when JWT claims are empty", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "ai.",
        agencyAddons: [],
        planId: "command",
      }),
    ).toBe(true);
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "reliability.",
        agencyAddons: [],
        planId: "command",
      }),
    ).toBe(true);
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "translation.",
        agencyAddons: [],
        planId: "command",
      }),
    ).toBe(true);
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "ai.",
        agencyAddons: [],
        planId: "essential",
      }),
    ).toBe(false);
  });

  it("honors explicit agency.addons when plan does not include the family", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "ai.",
        agencyAddons: ["ai.triage.basic"],
        planId: "essential",
      }),
    ).toBe(true);
  });
});
