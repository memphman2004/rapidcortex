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
    expect(defaultPermissionForRole("dispatcher", "call_assist.qa.view")).toBe(false);
    expect(defaultPermissionForRole("dispatcher", "call_assist.prompts.manage")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "call_assist.demo.run")).toBe(true);
    expect(defaultPermissionForRole("agencyadmin", "call_assist.prompts.manage")).toBe(true);
    expect(defaultPermissionForRole("supervisor", "call_assist.qa.view")).toBe(true);
    expect(defaultPermissionForRole("analyst", "call_assist.analytics.view")).toBe(true);
    expect(defaultPermissionForRole("rcitadmin", "call_assist.admin.config")).toBe(true);
  });

  it("isolates Call Assist–only roles from the 911 dispatcher workspace", () => {
    expect(defaultPermissionForRole("call_assist_operator", "call_assist.session.view")).toBe(true);
    expect(defaultPermissionForRole("call_assist_operator", "workspace.live_call")).toBe(false);
    expect(defaultPermissionForRole("call_assist_operator", "incidents.view")).toBe(false);
    expect(defaultPermissionForRole("call_assist_operator", "call_assist.admin.config")).toBe(false);
    expect(defaultPermissionForRole("call_assist_supervisor", "call_assist.qa.view")).toBe(true);
    expect(defaultPermissionForRole("call_assist_supervisor", "call_assist.admin.config")).toBe(false);
    expect(defaultPermissionForRole("call_assist_admin", "call_assist.admin.config")).toBe(true);
    expect(defaultPermissionForRole("call_assist_admin", "call_assist.demo.run")).toBe(true);
    expect(defaultPermissionForRole("call_assist_admin", "users.create")).toBe(true);
    expect(defaultPermissionForRole("call_assist_operator", "users.create")).toBe(false);
    expect(defaultPermissionForRole("call_assist_admin", "workspace.live_call")).toBe(false);
    expect(defaultPermissionForRole("CALL_ASSIST_OPERATOR" as "call_assist_operator", "call_assist.session.view")).toBe(
      true,
    );
  });
});
