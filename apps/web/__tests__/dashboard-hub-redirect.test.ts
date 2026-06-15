import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared/types";
import { PLATFORM_AGENCY_ID } from "rapid-cortex-shared/tenancy/constants";
import {
  dashboardHubRedirectForInternalOperator,
  resolveDashboardHubRedirectHref,
  shouldRedirectAwayFromDashboardHub,
} from "@/lib/auth/dashboard-hub-redirect";

const superadmin: UserContext = {
  userId: "u1",
  role: "rcsuperadmin",
  agencyId: PLATFORM_AGENCY_ID,
  email: "ops@rapidcortex.us",
};

describe("resolveDashboardHubRedirectHref", () => {
  it("sends rcsuperadmin to rc-admin when password rotation bypass is active", () => {
    expect(
      resolveDashboardHubRedirectHref(superadmin, { passwordRotationBypass: true }),
    ).toBe("/rc-admin/dashboard");
  });

  it("honors trusted from param after password change", () => {
    expect(
      resolveDashboardHubRedirectHref(superadmin, {
        passwordRotationBypass: true,
        fromParam: "/rc-admin/agencies",
      }),
    ).toBe("/rc-admin/agencies");
  });
});

describe("shouldRedirectAwayFromDashboardHub", () => {
  it("returns true for platform operators", () => {
    expect(shouldRedirectAwayFromDashboardHub(superadmin)).toBe(true);
  });

  it("returns false for agency dispatchers", () => {
    const dispatcher: UserContext = {
      userId: "d1",
      role: "dispatcher",
      agencyId: "test-agency",
      email: "d@test.gov",
    };
    expect(shouldRedirectAwayFromDashboardHub(dispatcher)).toBe(false);
  });
});

describe("dashboardHubRedirectForInternalOperator", () => {
  it("routes rcsuperadmin to platform command", () => {
    expect(dashboardHubRedirectForInternalOperator(superadmin)).toBe("/rc-admin/dashboard");
  });
});
