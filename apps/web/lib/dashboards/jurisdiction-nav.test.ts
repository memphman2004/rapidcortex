import { describe, expect, it } from "vitest";
import {
  isAbsoluteRoleShellPath,
  resolveRoleNavHref,
} from "./jurisdiction-nav";

describe("resolveRoleNavHref", () => {
  it("prefixes jurisdiction paths for supervisor", () => {
    expect(
      resolveRoleNavHref("supervisor", { id: "overview", label: "Ops", href: "/supervisor" }, "example-city"),
    ).toBe("/example-city/supervisor");
  });

  it("keeps agency-admin billing on role shell path", () => {
    expect(
      resolveRoleNavHref(
        "agency-admin",
        { id: "billing", label: "Billing", href: "/agency-admin/billing" },
        "example-city",
      ),
    ).toBe("/agency-admin/billing");
  });

  it("prefixes agency-admin ops under jurisdiction", () => {
    expect(
      resolveRoleNavHref("agency-admin", { id: "users", label: "Users", href: "/admin/users" }, "example-city"),
    ).toBe("/example-city/admin/users");
  });

  it("falls back to hash on role shell when href omitted", () => {
    expect(
      resolveRoleNavHref("executive", { id: "grants", label: "Grants" }, "example-city"),
    ).toBe("/executive/dashboard#grants");
  });
});

describe("isAbsoluteRoleShellPath", () => {
  it("detects rc-admin and agency-admin roots", () => {
    expect(isAbsoluteRoleShellPath("/rc-admin/dashboard")).toBe(true);
    expect(isAbsoluteRoleShellPath("/agency-admin/billing")).toBe(true);
    expect(isAbsoluteRoleShellPath("/admin/users")).toBe(false);
  });
});
