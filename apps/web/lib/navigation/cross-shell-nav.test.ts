import { describe, expect, it } from "vitest";
import {
  requiresHardCrossShellNav,
  workspaceShellFromPath,
} from "./cross-shell-nav";

describe("workspaceShellFromPath", () => {
  it("classifies rc-admin and sales shells", () => {
    expect(workspaceShellFromPath("/rc-admin/dashboard")).toBe("rc-admin");
    expect(workspaceShellFromPath("/rc-admin")).toBe("rc-admin");
    expect(workspaceShellFromPath("/sales")).toBe("sales");
    expect(workspaceShellFromPath("/sales/pricing-catalog")).toBe("sales");
    expect(workspaceShellFromPath("/login")).toBe("other");
  });
});

describe("requiresHardCrossShellNav", () => {
  it("requires hard nav between rc-admin and sales", () => {
    expect(requiresHardCrossShellNav("/rc-admin/dashboard", "/sales")).toBe(true);
    expect(requiresHardCrossShellNav("/sales", "/rc-admin/leads")).toBe(true);
    expect(requiresHardCrossShellNav("/rc-admin/leads", "/rc-admin/users")).toBe(false);
    expect(requiresHardCrossShellNav("/sales", "/sales/document-library")).toBe(false);
    expect(requiresHardCrossShellNav("/rc-admin/dashboard", "/loadout/dashboard")).toBe(
      false,
    );
  });

  it("ignores query/hash on destination", () => {
    expect(requiresHardCrossShellNav("/rc-admin/dashboard", "/sales?tab=1")).toBe(true);
  });
});
