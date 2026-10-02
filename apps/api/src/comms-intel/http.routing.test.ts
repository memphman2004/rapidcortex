import { describe, expect, it } from "vitest";
import { agencySatisfiesAddonFamily } from "../middleware/requireAddon.js";

/**
 * Contract: HTTP gates use requireAddon → agencySatisfiesAddonFamily
 * (JWT custom:addons → agency.addons → plan-included catalog).
 */
describe("comms-intel requireAddon family contracts", () => {
  it("Context Cards included on essential via plan catalog", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "comms_intel.context_cards",
        agencyAddons: [],
        planId: "essential",
      }),
    ).toBe(true);
  });

  it("Vault not plan-included on essential; paid agency.addons unlocks", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "comms_intel.nexiq_vault",
        agencyAddons: [],
        planId: "essential",
      }),
    ).toBe(false);
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "comms_intel.nexiq_vault",
        agencyAddons: ["comms_intel.nexiq_vault"],
        planId: "essential",
      }),
    ).toBe(true);
  });

  it("Command Intelligence plan-included on professional", () => {
    expect(
      agencySatisfiesAddonFamily({
        familyPrefix: "comms_intel.command_intelligence",
        agencyAddons: [],
        planId: "professional",
      }),
    ).toBe(true);
  });
});
