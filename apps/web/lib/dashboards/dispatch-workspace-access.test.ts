import { describe, expect, it } from "vitest";
import {
  isDispatchLiveWorkspaceSubpath,
  roleMayAccessDispatchLiveWorkspace,
} from "./dispatch-workspace-access";

describe("dispatch live workspace access", () => {
  it("identifies live ops paths", () => {
    expect(isDispatchLiveWorkspaceSubpath("/dashboard")).toBe(true);
    expect(isDispatchLiveWorkspaceSubpath("/transcription/live")).toBe(true);
    expect(isDispatchLiveWorkspaceSubpath("/history")).toBe(false);
    expect(isDispatchLiveWorkspaceSubpath("/admin")).toBe(false);
  });

  it("allows dispatcher and supervisor only", () => {
    expect(roleMayAccessDispatchLiveWorkspace("dispatcher")).toBe(true);
    expect(roleMayAccessDispatchLiveWorkspace("supervisor")).toBe(true);
    expect(roleMayAccessDispatchLiveWorkspace("agencyadmin")).toBe(false);
    expect(roleMayAccessDispatchLiveWorkspace("analyst")).toBe(false);
    expect(roleMayAccessDispatchLiveWorkspace("agencyit")).toBe(false);
  });
});
