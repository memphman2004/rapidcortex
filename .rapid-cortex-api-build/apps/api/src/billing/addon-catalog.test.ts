import { describe, expect, it } from "vitest";
import {
  ADDON_CATALOG,
  ADDON_KEYS,
  getAddonByKey,
  isAddonActiveForTenant,
  isAddonIncludedInPlan,
  isAddonOptedOut,
} from "rapid-cortex-shared";

describe("add-on catalog", () => {
  it("defines every ADDON_KEYS entry in the catalog", () => {
    expect(ADDON_CATALOG.length).toBe(ADDON_KEYS.length);
    for (const key of ADDON_KEYS) {
      expect(getAddonByKey(key).key).toBe(key);
    }
  });

  it("marks incident command dashboard as included in Command and Enterprise", () => {
    const def = getAddonByKey("incident_command.command_dashboard");
    expect(isAddonIncludedInPlan(def, "Command")).toBe(true);
    expect(isAddonIncludedInPlan(def, "Essential")).toBe(false);
  });

  it("includes Context Cards on all plans; Vault on Command+", () => {
    const cards = getAddonByKey("comms_intel.context_cards");
    expect(isAddonIncludedInPlan(cards, "Essential")).toBe(true);
    const vault = getAddonByKey("comms_intel.nexiq_vault");
    expect(isAddonIncludedInPlan(vault, "Command")).toBe(true);
    expect(isAddonIncludedInPlan(vault, "Essential")).toBe(false);
  });

  it("marks translation.live tier1 as included in Professional+", () => {
    const def = getAddonByKey("translation.live.tier1");
    expect(isAddonIncludedInPlan(def, "Professional")).toBe(true);
    expect(isAddonIncludedInPlan(def, "Essential")).toBe(false);
  });

  it("treats plan-included add-ons as active until they are opted out", () => {
    const def = getAddonByKey("translation.live.tier1");
    expect(isAddonActiveForTenant(def, "Professional", { enabled: false })).toBe(true);
    expect(isAddonOptedOut({ enabled: false, disabledAt: "2026-09-17T00:00:00.000Z" })).toBe(true);
    expect(
      isAddonActiveForTenant(def, "Professional", {
        enabled: false,
        disabledAt: "2026-09-17T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});
