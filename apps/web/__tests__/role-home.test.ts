import { describe, expect, it } from "vitest";
import { jurisdictionRoleHomeHref } from "../lib/auth/role-home";

describe("jurisdictionRoleHomeHref", () => {
  const slug = "columbus";

  it.each([
    ["dispatcher", `/${slug}/dashboard`],
    ["supervisor", `/${slug}/supervisor`],
    ["agencyadmin", `/${slug}/admin`],
    ["agencyit", `/${slug}/admin/it`],
    ["analyst", `/${slug}/analytics`],
    ["auditor", `/${slug}/audit`],
    ["rcadmin", "/rc-admin/dashboard"],
    ["rcitadmin", "/rc-admin/infrastructure"],
    ["rcsuperadmin", "/rc-admin/dashboard"],
  ] as const)("maps %s → %s", (role, expected) => {
    expect(jurisdictionRoleHomeHref(role, slug)).toBe(expected);
  });
});
