import { describe, expect, it } from "vitest";
import { defaultPermissionForRole } from "./permissions.js";

describe("Field 911 Dispatch RBAC", () => {
  it("lets supervisors act and dispatchers only view", () => {
    expect(defaultPermissionForRole("supervisor", "field.command.view")).toBe(true);
    expect(defaultPermissionForRole("supervisor", "field.command.act")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "field.command.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "field.command.act")).toBe(false);
  });

  it("does not grant Command to hospital staff", () => {
    expect(defaultPermissionForRole("hospitalstaff", "field.command.view")).toBe(false);
  });
});
