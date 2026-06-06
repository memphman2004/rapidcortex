import type { JWTPayload } from "jose";
import { describe, expect, it } from "vitest";
import { mapJwtToUser } from "../verify-cognito";

const BASE: JWTPayload = {
  sub: "usr-1",
  email: "user@agency.gov",
};

describe("mapJwtToUser (ID token parsing)", () => {
  it("allows active users without custom:status so session can load post-login", () => {
    const u = mapJwtToUser({
      ...BASE,
      "custom:role": "dispatcher",
      "custom:agencyId": "agency-123",
    } as JWTPayload);
    expect(u).not.toBeNull();
    expect(u!.role).toBe("dispatcher");
  });

  it("rejects explicit inactive status", () => {
    expect(
      mapJwtToUser({
        ...BASE,
        "custom:role": "dispatcher",
        "custom:agencyId": "agency-123",
        "custom:status": "inactive",
      } as JWTPayload),
    ).toBeNull();
  });

  it("reads role from cognito:groups when custom:role is absent", () => {
    const u = mapJwtToUser({
      ...BASE,
      "custom:agencyId": "agency-123",
      "cognito:groups": ["dispatcher"],
    } as JWTPayload);
    expect(u).not.toBeNull();
    expect(u!.role).toBe("dispatcher");
  });

  it("maps superadmin legacy group to rcsuperadmin routing role", () => {
    const u = mapJwtToUser({
      ...BASE,
      "custom:agencyId": "agency-123",
      "cognito:groups": ["superadmin"],
    } as JWTPayload);
    expect(u).not.toBeNull();
    expect(u!.role).toBe("rcsuperadmin");
  });
});
