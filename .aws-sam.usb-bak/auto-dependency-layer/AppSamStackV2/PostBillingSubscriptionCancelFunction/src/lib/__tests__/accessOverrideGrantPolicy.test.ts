import { describe, expect, it } from "vitest";
import { assertGrantWithinAuthority } from "../accessOverrideGrantPolicy.js";
import type { UserContext } from "rapid-cortex-shared";

const agencyAdmin = (agencyId = "a1"): UserContext =>
  ({
    userId: "adm1",
    agencyId,
    role: "agencyadmin",
    email: "admin@test.com",
  }) as UserContext;

const rcAdmin = (): UserContext =>
  ({
    userId: "psa",
    agencyId: "platform-agency-id",
    role: "rcsuperadmin",
    email: "ops@rapid.test",
  }) as UserContext;

describe("assertGrantWithinAuthority", () => {
  it("allows agency admin to assign dashboard qa permission grant", () => {
    expect(() =>
      assertGrantWithinAuthority(
        agencyAdmin(),
        "permission",
        "dashboard:qa",
      ),
    ).not.toThrow();
  });

  it("blocks agency admin from granting RC Admin dashboards", () => {
    expect(() =>
      assertGrantWithinAuthority(agencyAdmin(), "permission", "dashboard:rc-admin"),
    ).toThrow("INVALID_GRANT");
  });

  it("allows RC Admin elevated dashboard grants", () => {
    expect(() =>
      assertGrantWithinAuthority(rcAdmin(), "permission", "dashboard:agency-admin"),
    ).not.toThrow();
  });
});
