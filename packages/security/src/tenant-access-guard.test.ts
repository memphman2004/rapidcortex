import { describe, expect, it } from "vitest";
import type { Incident, UserContext } from "rapid-cortex-shared";
import { TenantAccessGuard } from "./tenant-access-guard.js";

const baseIncident = (agencyId: string): Incident =>
  ({
    agencyId,
    incidentId: "inc_test",
    title: "t",
    category: "unknown",
    urgency: "low",
    status: "active",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    callerAddressLine: null,
    callerAddressNormalized: null,
    callerLocationLat: null,
    callerLocationLng: null,
    callerLocationMapLabel: null,
  }) as Incident;

const user = (role: UserContext["role"], agencyId: string): UserContext => ({
  userId: "u1",
  agencyId,
  role,
  email: "x@y.gov",
});

describe("TenantAccessGuard", () => {
  it("isSameAgency matches exact agency id", () => {
    expect(TenantAccessGuard.isSameAgency("a", "a")).toBe(true);
    expect(TenantAccessGuard.isSameAgency("a", "b")).toBe(false);
  });

  it("assertSameAgency throws on mismatch", () => {
    expect(() => TenantAccessGuard.assertSameAgency("x", "y")).toThrow();
  });

  it("assertIncidentAccess allows rcsuperadmin across tenants", () => {
    expect(() =>
      TenantAccessGuard.assertIncidentAccess(baseIncident("other"), user("rcsuperadmin", "self")),
    ).not.toThrow();
  });

  it("assertIncidentAccess denies rcitadmin on foreign incidents", () => {
    expect(() =>
      TenantAccessGuard.assertIncidentAccess(baseIncident("other"), user("rcitadmin", "self")),
    ).toThrow("TENANT_MISMATCH");
  });

  it("assertAgencyScopeForPermission allows rcitadmin for user-management permissions cross-tenant", () => {
    expect(() =>
      TenantAccessGuard.assertAgencyScopeForPermission({
        user: user("rcitadmin", "self"),
        permission: "users.reset_password",
        resourceAgencyId: "other",
      }),
    ).not.toThrow();
  });

  it("assertAgencyScopeForPermission denies rcitadmin for incident-style permissions cross-tenant", () => {
    expect(() =>
      TenantAccessGuard.assertAgencyScopeForPermission({
        user: user("rcitadmin", "self"),
        permission: "incidents.view",
        resourceAgencyId: "other",
      }),
    ).toThrow("TENANT_MISMATCH");
  });
});
