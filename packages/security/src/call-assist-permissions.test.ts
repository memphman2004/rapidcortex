import { describe, expect, it } from "vitest";
import { defaultPermissionForRole } from "./permissions.js";

describe("Call Assist RBAC", () => {
  it("grants session view to dispatcher and not hospital staff", () => {
    expect(defaultPermissionForRole("dispatcher", "call_assist.session.view")).toBe(true);
    expect(defaultPermissionForRole("hospitalstaff", "call_assist.session.view")).toBe(false);
  });

  it("does not let dispatcher manage retention or run demos", () => {
    expect(defaultPermissionForRole("dispatcher", "call_assist.retention.manage")).toBe(false);
    expect(defaultPermissionForRole("dispatcher", "call_assist.demo.run")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "call_assist.demo.run")).toBe(true);
    expect(defaultPermissionForRole("rcitadmin", "call_assist.admin.config")).toBe(true);
  });
});
