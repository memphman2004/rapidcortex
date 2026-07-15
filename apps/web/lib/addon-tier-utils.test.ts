import { describe, expect, it } from "vitest";
import { getAddonByKey, isAddonIncludedInPlan, type AddonKey } from "rapid-cortex-shared";
import { activeTierKeyInFamily, addonTierFamily, buildAddonGridRows } from "./addon-tier-utils";

describe("addonTierFamily", () => {
  it("strips known tier suffixes", () => {
    expect(addonTierFamily("transcription.enhanced.tier1")).toBe("transcription.enhanced");
    expect(addonTierFamily("ai.triage.standard")).toBe("ai.triage");
  });
});

describe("buildAddonGridRows", () => {
  it("groups transcription enhanced as tiered", () => {
    const row = buildAddonGridRows().find(
      (r) => r.kind === "tiered" && r.family === "transcription.enhanced",
    );
    expect(row?.kind).toBe("tiered");
    if (row?.kind === "tiered") {
      expect(row.variants.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("activeTierKeyInFamily", () => {
  const variants = [
    getAddonByKey("transcription.enhanced.tier1"),
    getAddonByKey("transcription.enhanced.tier2"),
    getAddonByKey("transcription.enhanced.tier3"),
  ];

  it("returns plan-included tier when nothing else is enabled", () => {
    const key = activeTierKeyInFamily(
      "transcription.enhanced",
      variants,
      {} as Record<AddonKey, { enabled?: boolean }>,
      "Professional",
      isAddonIncludedInPlan,
    );
    expect(key).toBe("transcription.enhanced.tier1");
  });

  it("prefers an enabled paid upgrade over the plan-included base", () => {
    const key = activeTierKeyInFamily(
      "transcription.enhanced",
      variants,
      {
        "transcription.enhanced.tier2": { enabled: true },
      } as Record<AddonKey, { enabled?: boolean }>,
      "Professional",
      isAddonIncludedInPlan,
    );
    expect(key).toBe("transcription.enhanced.tier2");
  });

  it("returns empty when no included tier and nothing enabled", () => {
    const key = activeTierKeyInFamily(
      "transcription.enhanced",
      variants,
      {} as Record<AddonKey, { enabled?: boolean }>,
      "Essential",
      isAddonIncludedInPlan,
    );
    expect(key).toBe("");
  });
});
