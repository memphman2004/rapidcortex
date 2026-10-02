import { describe, expect, it } from "vitest";
import { pathTenantId } from "./tenant-addons.js";

describe("pathTenantId", () => {
  it("parses tenant id and entitlements tail from raw path", () => {
    expect(pathTenantId("/api/admin/tenants/test-agency/entitlements")).toEqual({
      tenantId: "test-agency",
      tail: ["entitlements"],
    });
  });

  it("prefers API Gateway pathParameters over raw path segments", () => {
    expect(
      pathTenantId("/api/admin/tenants/wrong-id/entitlements", {
        tenantId: "test-venue-mbs",
      }),
    ).toEqual({
      tenantId: "test-venue-mbs",
      tail: ["entitlements"],
    });
  });

  it("accepts legacy agencyId path parameter name", () => {
    expect(pathTenantId("/api/admin/tenants/foo/entitlements", { agencyId: "bar" })).toEqual({
      tenantId: "bar",
      tail: ["entitlements"],
    });
  });
});
