import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getPasswordAgeDays,
  isPasswordExpired,
  requiresOperationalPasswordRenewal,
  canAdminForcePasswordReset,
} from "./password-policy.js";
import type { UserContext } from "../types.js";

describe("password-policy", () => {
  const baseUser = (over: Partial<UserContext>): UserContext => ({
    userId: "u1",
    agencyId: "a1",
    role: "dispatcher",
    email: "u@example.com",
    ...over,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
  });

  afterEach(() => {
    delete process.env.PASSWORD_MAX_AGE_DAYS;
    delete process.env.PASSWORD_CHANGE_REQUIRED_ON_FIRST_LOGIN;
    delete process.env.PASSWORD_EXPIRY_GRACE_DAYS;
    vi.useRealTimers();
  });

  it("getPasswordAgeDays counts whole UTC days", () => {
    const iso = "2026-02-01T12:00:00.000Z";
    expect(getPasswordAgeDays(iso)).toBe(28);
  });

  it("missing timestamp requires renewal when first-login flag is enabled (default)", () => {
    process.env.PASSWORD_CHANGE_REQUIRED_ON_FIRST_LOGIN = "true";
    expect(
      requiresOperationalPasswordRenewal(
        baseUser({ passwordChangeRequired: false, passwordLastChangedAt: undefined }),
      ),
    ).toBe(true);
  });

  it("password older than 60 days requires renewal", () => {
    process.env.PASSWORD_MAX_AGE_DAYS = "60";
    const iso = "2025-12-01T12:00:00.000Z";
    expect(isPasswordExpired(iso)).toBe(true);
    expect(
      requiresOperationalPasswordRenewal(baseUser({ passwordLastChangedAt: iso, passwordChangeRequired: false })),
    ).toBe(true);
  });

  it("password at day 59 does not expire", () => {
    process.env.PASSWORD_MAX_AGE_DAYS = "60";
    const iso = "2025-12-31T13:00:00.000Z";
    expect(isPasswordExpired(iso)).toBe(false);
    expect(
      requiresOperationalPasswordRenewal(baseUser({ passwordLastChangedAt: iso, passwordChangeRequired: false })),
    ).toBe(false);
  });

  it("passwordChangeRequired=true forces renewal regardless of timestamp", () => {
    process.env.PASSWORD_CHANGE_REQUIRED_ON_FIRST_LOGIN = "false";
    expect(
      requiresOperationalPasswordRenewal(
        baseUser({
          passwordLastChangedAt: "2026-02-28T12:00:00.000Z",
          passwordChangeRequired: true,
        }),
      ),
    ).toBe(true);
  });

  it("canAdminForcePasswordReset is limited to agencyadmin/agencyit same agency, rcsuperadmin, and rcitadmin", () => {
    expect(
      canAdminForcePasswordReset(
        baseUser({ role: "supervisor", agencyId: "a1" }),
        { targetAgencyId: "a1" },
      ),
    ).toBe(false);
    expect(
      canAdminForcePasswordReset(baseUser({ role: "auditor", agencyId: "a1" }), { targetAgencyId: "a1" }),
    ).toBe(false);
    expect(canAdminForcePasswordReset(baseUser({ role: "agencyadmin", agencyId: "a1" }), { targetAgencyId: "a1" })).toBe(
      true,
    );
    expect(canAdminForcePasswordReset(baseUser({ role: "agencyit", agencyId: "a1" }), { targetAgencyId: "a1" })).toBe(
      true,
    );
    expect(canAdminForcePasswordReset(baseUser({ role: "agencyadmin", agencyId: "a1" }), { targetAgencyId: "a2" })).toBe(
      false,
    );
    expect(
      canAdminForcePasswordReset(baseUser({ role: "rcsuperadmin", agencyId: "__platform__" }), { targetAgencyId: "a2" }),
    ).toBe(true);
    expect(
      canAdminForcePasswordReset(baseUser({ role: "rcitadmin", agencyId: "__platform__" }), { targetAgencyId: "a2" }),
    ).toBe(true);
    expect(
      canAdminForcePasswordReset(baseUser({ role: "rcadmin", agencyId: "__platform__" }), { targetAgencyId: "a2" }),
    ).toBe(false);
  });
});
