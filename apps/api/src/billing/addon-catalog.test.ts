import { describe, expect, it } from "vitest";
import {
  ADDON_CATALOG,
  ADDON_KEYS,
  getAddonByKey,
  isAddonIncludedInPlan,
} from "rapid-cortex-shared";

describe("add-on catalog", () => {
  it("defines every ADDON_KEYS entry in the catalog", () => {
    expect(ADDON_CATALOG.length).toBe(ADDON_KEYS.length);
    for (const key of ADDON_KEYS) {
      expect(getAddonByKey(key).key).toBe(key);
    }
  });

  it("marks incident command as included in Command and Enterprise", () => {
    const def = getAddonByKey("incident.command.full");
    expect(isAddonIncludedInPlan(def, "Command")).toBe(true);
    expect(isAddonIncludedInPlan(def, "Essential")).toBe(false);
  });

  it("marks translation.live tier1 as included in Professional+", () => {
    const def = getAddonByKey("translation.live.tier1");
    expect(isAddonIncludedInPlan(def, "Professional")).toBe(true);
    expect(isAddonIncludedInPlan(def, "Essential")).toBe(false);
  });
});
