import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared";
import {
  canCreateQrNfcCodes,
  canDeactivateQrNfcCodes,
  canProgramQrNfcTags,
  canViewQrNfcCodes,
} from "./qr-nfc-access.js";

function makeUser(role: string, agencyId = "test-transit-hvt"): UserContext {
  return {
    userId: "u1",
    agencyId,
    role: role as UserContext["role"],
    email: "u@test.com",
  };
}

describe("QR/NFC named-code access", () => {
  const agencyId = "test-transit-hvt";

  it("lets transit admin and supervisor create and deactivate codes in-tenant", () => {
    const admin = makeUser("transit_admin");
    const supervisor = makeUser("TRANSIT_SUPERVISOR");
    expect(canCreateQrNfcCodes(admin, agencyId)).toBe(true);
    expect(canDeactivateQrNfcCodes(supervisor, agencyId)).toBe(true);
    expect(canCreateQrNfcCodes(admin, "other-agency")).toBe(false);
  });

  it("lets transit security program NFC but not create or delete codes", () => {
    const security = makeUser("transit_security");
    expect(canProgramQrNfcTags(security, agencyId)).toBe(true);
    expect(canViewQrNfcCodes(security, agencyId)).toBe(true);
    expect(canCreateQrNfcCodes(security, agencyId)).toBe(false);
    expect(canDeactivateQrNfcCodes(security, agencyId)).toBe(false);
  });

  it("denies transit operator QR/NFC management", () => {
    const operator = makeUser("transit_operator");
    expect(canViewQrNfcCodes(operator, agencyId)).toBe(false);
    expect(canCreateQrNfcCodes(operator, agencyId)).toBe(false);
    expect(canProgramQrNfcTags(operator, agencyId)).toBe(false);
  });
});
