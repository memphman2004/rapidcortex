import { describe, expect, it } from "vitest";
import {
  canUseCommandIntelligence,
  canUseContextCards,
  canUseNexiqVault,
} from "./entitlements.js";

describe("comms intel entitlements", () => {
  it("includes Context Cards on all plans by default", () => {
    expect(canUseContextCards("essential")).toBe(true);
    expect(canUseContextCards("professional")).toBe(true);
    expect(canUseContextCards("command")).toBe(true);
    expect(canUseContextCards("enterprise")).toBe(true);
  });

  it("allows opt-out of Context Cards", () => {
    expect(
      canUseContextCards("enterprise", {
        "comms_intel.context_cards": { enabled: false, disabledAt: "2026-01-01T00:00:00.000Z" },
      }),
    ).toBe(false);
  });

  it("gates Command Intelligence to Professional+", () => {
    expect(canUseCommandIntelligence("essential")).toBe(false);
    expect(canUseCommandIntelligence("professional")).toBe(true);
    expect(canUseCommandIntelligence("command")).toBe(true);
  });

  it("allows paid enable of Command Intelligence on Essential", () => {
    expect(
      canUseCommandIntelligence("essential", {
        "comms_intel.command_intelligence": { enabled: true },
      }),
    ).toBe(true);
  });

  it("gates NexiQ Vault to Command+", () => {
    expect(canUseNexiqVault("essential")).toBe(false);
    expect(canUseNexiqVault("professional")).toBe(false);
    expect(canUseNexiqVault("command")).toBe(true);
    expect(canUseNexiqVault("enterprise")).toBe(true);
  });
});
