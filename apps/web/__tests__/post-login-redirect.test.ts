import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared";
import {
  resolvePostAuthenticationHomeHref,
  resolvePostLoginNavigationHref,
  resolvePostLoginNavigationHrefAfterPasswordChange,
  resolveProductDashboardFromRoleAndAgency,
} from "../lib/auth/post-login-redirect";

function subscriberAgencyAdmin(): UserContext {
  return {
    userId: "u1",
    agencyId: "a1",
    role: "agencyadmin",
    email: "admin@example.gov",
    planId: "enterprise_statewide",
    isSubscriber: true,
    passwordLastChangedAt: new Date().toISOString(),
  };
}

describe("resolvePostLoginNavigationHref", () => {
  const slug = "columbus";
  const admin = subscriberAgencyAdmin();

  it("maps legacy jurisdiction /dashboard hub to role home instead of dispatcher shell", () => {
    expect(resolvePostLoginNavigationHref(admin, `/${slug}/dashboard`, slug)).toBe(
      `/${slug}/admin`,
    );
  });

  it("honors trusted role-dashboard paths the user may access", () => {
    expect(resolvePostLoginNavigationHref(admin, `/agency-admin/overrides`, slug)).toBe(
      `/agency-admin/overrides`,
    );
  });

  it("replaces forbidden role-dashboard targets with canonical home", () => {
    expect(resolvePostLoginNavigationHref(admin, "/dispatcher/dashboard", slug)).toBe(
      `/${slug}/admin`,
    );
  });

  it("returns canonical home when no from param", () => {
    expect(resolvePostLoginNavigationHref(admin, null, slug)).toBe(`/${slug}/admin`);
  });
});

describe("resolveProductDashboardFromRoleAndAgency", () => {
  it("sends RC internal roles to concrete dashboard routes", () => {
    expect(resolveProductDashboardFromRoleAndAgency("rcsuperadmin", "__platform__")).toBe(
      "/rc-admin/dashboard",
    );
    expect(resolveProductDashboardFromRoleAndAgency("rcadmin", "__platform__")).toBe(
      "/rc-admin/dashboard",
    );
    expect(resolveProductDashboardFromRoleAndAgency("rcitadmin", "__platform__")).toBe(
      "/rc-admin/infrastructure",
    );
  });
});

describe("resolvePostLoginNavigationHrefAfterPasswordChange", () => {
  const slug = "columbus";

  it("skips renewal gate and routes to role home when pwdChangeReq is still true", () => {
    const user: UserContext = {
      userId: "u-disp",
      agencyId: "a1",
      role: "dispatcher",
      email: "disp@example.gov",
      passwordChangeRequired: true,
      isSubscriber: true,
      planId: "enterprise_statewide",
    };
    expect(resolvePostLoginNavigationHref(user, null, slug)).toBe("/change-password");
    expect(resolvePostLoginNavigationHrefAfterPasswordChange(user, null, slug)).toBe(
      `/${slug}/dashboard`,
    );
  });
});

describe("resolvePostAuthenticationHomeHref", () => {
  it("sends rcsuperadmin to RC Admin dashboard", () => {
    const user: UserContext = {
      userId: "u-sa",
      agencyId: "__platform__",
      role: "rcsuperadmin",
      email: "rcsuperadmin@appsondemand.net",
      passwordLastChangedAt: new Date().toISOString(),
    };
    expect(resolvePostAuthenticationHomeHref(user)).toBe("/rc-admin/dashboard");
  });
});
