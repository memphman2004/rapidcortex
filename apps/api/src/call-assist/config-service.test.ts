import { describe, expect, it } from "vitest";
import { buildDefaultTenantConfig } from "./config-service.js";

describe("Call Assist default tenant config", () => {
  it("does not copy Kansas City seed onto a second agency when the kcpd profile is on", () => {
    const fulton = buildDefaultTenantConfig("fulton-county", "kcpd", "kcpd");
    expect(JSON.stringify(fulton)).not.toMatch(/Kansas City|KCPD|Troost|kcpd\.org|PremierOne/i);
    expect(fulton.cadProviderId).toBe("mock");
    expect(fulton.agencyShortName).toBeUndefined();
    expect(fulton.seededProfile).toBeUndefined();
  });

  it("still seeds the designated first tenant", () => {
    const kcpd = buildDefaultTenantConfig("kcpd", "kcpd", "kcpd");
    expect(kcpd.agencyShortName).toBe("KCPD");
    expect(kcpd.cadProviderId).toBe("motorola-premierone");
    expect(kcpd.demoScenarios?.some((s) => s.utterances.some((u) => u.includes("Troost")))).toBe(true);
  });
});
