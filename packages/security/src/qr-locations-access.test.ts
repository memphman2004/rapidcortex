import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared";
import { AuthorizationService } from "./authorization-service.js";
import { canManageQrLocations, canViewQrLocations } from "./qr-locations-access.js";

function makeUser(role: string, agencyId = "agency-campus-1"): UserContext {
  return {
    userId: "u1",
    agencyId,
    role: role as UserContext["role"],
    email: "u@test.com",
  };
}

describe("QR locations access (locations.qrcodes.*)", () => {
  const auth = new AuthorizationService();
  const agencyId = "agency-campus-1";

  it("grants CAMPUS_ADMIN manage + view within same agency", () => {
    const admin = makeUser("CAMPUS_ADMIN");
    expect(auth.canPerform(admin, "locations.qrcodes.manage")).toBe(true);
    expect(auth.canPerform(admin, "locations.qrcodes.view")).toBe(true);
    expect(canManageQrLocations(admin, agencyId)).toBe(true);
    expect(canViewQrLocations(admin, agencyId)).toBe(true);
  });

  it("grants CAMPUS_SUPERVISOR view only — not manage", () => {
    const sup = makeUser("CAMPUS_SUPERVISOR");
    expect(auth.canPerform(sup, "locations.qrcodes.view")).toBe(true);
    expect(auth.canPerform(sup, "locations.qrcodes.manage")).toBe(false);
    expect(canViewQrLocations(sup, agencyId)).toBe(true);
    expect(canManageQrLocations(sup, agencyId)).toBe(false);
  });

  it("grants VENUE_ADMIN manage within same agency", () => {
    const admin = makeUser("VENUE_ADMIN", "agency-venue-1");
    expect(canManageQrLocations(admin, "agency-venue-1")).toBe(true);
  });

  it("denies VENUE_SECURITY QR access", () => {
    const sec = makeUser("VENUE_SECURITY", "agency-venue-1");
    expect(canViewQrLocations(sec, "agency-venue-1")).toBe(false);
    expect(canManageQrLocations(sec, "agency-venue-1")).toBe(false);
  });

  it("denies VENUE_OPERATOR QR access", () => {
    const op = makeUser("VENUE_OPERATOR", "agency-venue-1");
    expect(canManageQrLocations(op, "agency-venue-1")).toBe(false);
    expect(canViewQrLocations(op, "agency-venue-1")).toBe(false);
  });

  it("grants rcadmin cross-tenant QR manage", () => {
    const admin = makeUser("rcadmin", "platform");
    expect(canManageQrLocations(admin, "agency-venue-1")).toBe(true);
    expect(canViewQrLocations(admin, "agency-venue-1")).toBe(true);
  });

  it("grants rcitadmin cross-tenant QR manage", () => {
    const itAdmin = makeUser("rcitadmin", "platform");
    expect(canManageQrLocations(itAdmin, "agency-venue-1")).toBe(true);
    expect(canViewQrLocations(itAdmin, "agency-venue-1")).toBe(true);
  });

  it("denies PSAP agencyadmin QR manage (campus/venue product only)", () => {
    const psapAdmin = makeUser("agencyadmin", "agency-psap-1");
    expect(auth.canPerform(psapAdmin, "locations.qrcodes.manage")).toBe(false);
    expect(canManageQrLocations(psapAdmin, "agency-psap-1")).toBe(false);
  });

  it("denies cross-tenant access for campus admin", () => {
    const admin = makeUser("CAMPUS_ADMIN", "agency-a");
    expect(canManageQrLocations(admin, "agency-b")).toBe(false);
    expect(canViewQrLocations(admin, "agency-b")).toBe(false);
  });

  it("allows rcsuperadmin cross-tenant", () => {
    const su = makeUser("rcsuperadmin", "platform");
    expect(canManageQrLocations(su, "any-agency")).toBe(true);
  });
});
