import { describe, expect, it } from "vitest";
import {
  hasActivePaidRelationship,
  hasRapidCortexDashboardAccess,
  hasRcLitePortalAccess,
  parseEntitlementsClaim,
  resolveSessionCustomerType,
} from "./session-product.js";
import type { UserContext } from "../types.js";

const baseUser = (over: Partial<UserContext> & Record<string, unknown>): UserContext & Record<string, unknown> => ({
  userId: "u1",
  agencyId: "a1",
  role: "dispatcher",
  email: "t@x.gov",
  ...over,
});

describe("session-product access", () => {
  it("parses entitlements from JSON array and comma lists", () => {
    const json = parseEntitlementsClaim('["api_access","dashboard_access"]');
    expect(json.has("api_access") && json.has("dashboard_access")).toBe(true);
    const csv = parseEntitlementsClaim("api_access, api_portal_access");
    expect(csv.has("api_access") && csv.has("api_portal_access")).toBe(true);
  });

  it("RC Lite plan id without dashboard flags does not grant dashboards but grants API portal", () => {
    const u = baseUser({
      planId: "rc_lite",
      isSubscriber: true,
      role: "dispatcher",
    });
    expect(resolveSessionCustomerType(u)).toBe("rc_lite_api");
    expect(hasRapidCortexDashboardAccess(u)).toBe(false);
    expect(hasRcLitePortalAccess(u)).toBe(true);
  });

  it("Essential plan grants dashboard access when subscriber", () => {
    const u = baseUser({
      planId: "essential",
      isSubscriber: true,
    });
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
    expect(hasRcLitePortalAccess(u)).toBe(false);
  });

  it("Command + api_access entitlement grants portal without rc_lite plan", () => {
    const u = baseUser({
      planId: "command",
      isSubscriber: true,
      sessionEntitlements: "api_access",
    });
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
    expect(hasRcLitePortalAccess(u)).toBe(true);
  });

  it("Enterprise / statewide plan bundles API surfaces so portal stays available with dashboards", () => {
    const u = baseUser({
      planId: "enterprise_statewide",
      isSubscriber: true,
      role: "agencyadmin",
    });
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
    expect(hasRcLitePortalAccess(u)).toBe(true);
  });

  it("rcsuperadmin always passes dashboard portal checks", () => {
    const u = baseUser({ role: "rcsuperadmin" });
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
    expect(hasRcLitePortalAccess(u)).toBe(true);
  });

  it("hybrid customerType with rc_lite plan id still reaches dashboards when flagged", () => {
    const u = baseUser({
      planId: "rc_lite",
      customerType: "hybrid",
      isSubscriber: true,
      role: "dispatcher",
    });
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
  });

  it("inactive subscriber relationship denies access", () => {
    const u = baseUser({
      planId: "essential",
      isSubscriber: false,
      subscriptionStatus: "canceled",
    });
    expect(hasActivePaidRelationship(u)).toBe(false);
    expect(hasRapidCortexDashboardAccess(u)).toBe(false);
  });

  it("hasActivePaidRelationship is true when legacy subscriber flag absent but plan present", () => {
    const u = baseUser({
      planId: "essential",
      subscriptionStatus: "active",
    });
    expect(hasActivePaidRelationship(u)).toBe(true);
  });

  it("platform_internal customer type grants active relationship and dashboard access without plan id", () => {
    const u = baseUser({
      customerType: "platform_internal",
      role: "dispatcher",
    });
    expect(hasActivePaidRelationship(u)).toBe(true);
    expect(hasRapidCortexDashboardAccess(u)).toBe(true);
  });
});
