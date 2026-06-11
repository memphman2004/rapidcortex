import { describe, expect, it } from "vitest";
import type { TenantEntitlements } from "rapid-cortex-shared";
import { rapidCortexFeatureIdsFromTenantEntitlements } from "./tenant-addon-feature-bridge";

function seedEntitlements(partial: Partial<TenantEntitlements>): TenantEntitlements {
  const addons = {} as TenantEntitlements["addons"];
  for (const key of Object.keys(partial.addons ?? {})) {
    addons[key as keyof TenantEntitlements["addons"]] = partial.addons![
      key as keyof TenantEntitlements["addons"]
    ]!;
  }
  return {
    tenantId: "agency-1",
    plan: "essential",
    addons,
    lastModifiedAt: "2026-01-01T00:00:00.000Z",
    lastModifiedBy: "test@example.com",
    schemaVersion: 1,
    ...partial,
  };
}

describe("rapidCortexFeatureIdsFromTenantEntitlements", () => {
  it("maps enabled live translation SKU to live_translation", () => {
    const entitlements = seedEntitlements({
      addons: {
        "translation.live.tier1": { key: "translation.live.tier1", enabled: true },
      } as TenantEntitlements["addons"],
    });
    expect(rapidCortexFeatureIdsFromTenantEntitlements(entitlements)).toContain("live_translation");
  });

  it("does not map disabled essential-plan SKUs", () => {
    const entitlements = seedEntitlements({
      addons: {
        "translation.live.tier1": { key: "translation.live.tier1", enabled: false },
      } as TenantEntitlements["addons"],
    });
    expect(rapidCortexFeatureIdsFromTenantEntitlements(entitlements)).not.toContain("live_translation");
  });

  it("treats plan-included SKUs as active", () => {
    const entitlements = seedEntitlements({
      plan: "professional",
      addons: {
        "translation.live.tier1": { key: "translation.live.tier1", enabled: false },
      } as TenantEntitlements["addons"],
    });
    expect(rapidCortexFeatureIdsFromTenantEntitlements(entitlements)).toContain("live_translation");
  });
});
