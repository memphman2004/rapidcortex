import { describe, expect, it } from "vitest";
import { PRICING_DEFAULTS } from "./pricing-defaults.js";

describe("PRICING_DEFAULTS vs RC_Pricing_Master_Guide_v4 (Oct 2026)", () => {
  it("matches Essential / Professional / Command list fees", () => {
    expect(PRICING_DEFAULTS["ess.t1.monthly"]).toBe(2800);
    expect(PRICING_DEFAULTS["ess.t4.monthly"]).toBe(6000);
    expect(PRICING_DEFAULTS["pro.t1.monthly"]).toBe(8500);
    expect(PRICING_DEFAULTS["pro.t4.monthly"]).toBe(18000);
    expect(PRICING_DEFAULTS["cmd.t1.monthly"]).toBe(22500);
    expect(PRICING_DEFAULTS["cmd.t4.monthly"]).toBe(50000);
  });

  it("matches Caller Media and Support sheet bands", () => {
    expect(PRICING_DEFAULTS["media.photo.lo"]).toBe(1000);
    expect(PRICING_DEFAULTS["media.photo.hi"]).toBe(3500);
    expect(PRICING_DEFAULTS["media.video.lo"]).toBe(2500);
    expect(PRICING_DEFAULTS["media.video.hi"]).toBe(8500);
    expect(PRICING_DEFAULTS["media.stream.lo"]).toBe(5000);
    expect(PRICING_DEFAULTS["media.stream.hi"]).toBe(20000);
    expect(PRICING_DEFAULTS["media.sms.lo"]).toBe(1500);
    expect(PRICING_DEFAULTS["media.sms.hi"]).toBe(5000);
    expect(PRICING_DEFAULTS["support.priority.sm"]).toBe(2500);
    expect(PRICING_DEFAULTS["support.priority.md"]).toBe(5000);
    expect(PRICING_DEFAULTS["support.priority.lg"]).toBe(7500);
  });

  it("includes CAD automated T4 and Feature Add-On list prices", () => {
    expect(PRICING_DEFAULTS["cad.auto.t4"]).toBe(74000);
    expect(PRICING_DEFAULTS["nexiq.vault.lo"]).toBe(1200);
    expect(PRICING_DEFAULTS["comms.intel.lo"]).toBe(1500);
    expect(PRICING_DEFAULTS["call_assist.module"]).toBe(4500);
    expect(PRICING_DEFAULTS["call_assist.module.hi"]).toBe(9000);
  });
});
