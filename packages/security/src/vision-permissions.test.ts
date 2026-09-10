import { describe, expect, it } from "vitest";
import { defaultPermissionForRole } from "./permissions.js";

describe("Rapid Vision™ RBAC", () => {
  it("grants camera view to dispatcher and not hospital staff", () => {
    expect(defaultPermissionForRole("dispatcher", "vision.cameras_view")).toBe(true);
    expect(defaultPermissionForRole("hospitalstaff", "vision.cameras_view")).toBe(false);
  });

  it("does not let dispatcher change Vision admin settings", () => {
    expect(defaultPermissionForRole("dispatcher", "vision.admin")).toBe(false);
    expect(defaultPermissionForRole("agencyadmin", "vision.admin")).toBe(true);
    expect(defaultPermissionForRole("supervisor", "vision.observations_verify")).toBe(true);
  });
});
