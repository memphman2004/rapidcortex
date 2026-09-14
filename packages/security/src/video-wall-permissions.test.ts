import { describe, expect, it } from "vitest";
import type { UserContext, UserRole } from "rapid-cortex-shared";
import { AuthorizationService } from "./authorization-service.js";
import { defaultPermissionForRole } from "./permissions.js";

function makeUser(role: string): UserContext {
  return {
    userId: `user-${role}`,
    agencyId: "agency-a",
    role: role as UserRole,
    email: `${role}@example.com`,
  };
}

describe("Rapid Cortex Video wall RBAC", () => {
  const auth = new AuthorizationService();

  it("grants view+configure to campus admin and view-only to campus security", () => {
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN"), "video.wall.view")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN"), "video.wall.configure")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.wall.view")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.wall.configure")).toBe(false);
  });

  it("does not grant the wall to guest services or faculty", () => {
    expect(auth.canPerform(makeUser("VENUE_GUEST_SERVICES"), "video.wall.view")).toBe(false);
    expect(auth.canPerform(makeUser("CAMPUS_FACULTY"), "video.wall.view")).toBe(false);
    expect(auth.canPerform(makeUser("CAMPUS_COUNSELOR"), "video.wall.view")).toBe(false);
  });

  it("lets venue operators persist their own wall and dispatchers view it", () => {
    expect(auth.canPerform(makeUser("VENUE_OPERATOR"), "video.wall.configure")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "video.wall.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "video.wall.configure")).toBe(false);
  });

  it("grants DVR playback to wall viewers and recording configure to admins", () => {
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.playback.view")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.clips.create")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.clips.lock")).toBe(false);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.recording.configure")).toBe(false);
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN"), "video.recording.configure")).toBe(true);
    expect(auth.canPerform(makeUser("VENUE_SUPERVISOR"), "video.clips.lock")).toBe(true);
    expect(auth.canPerform(makeUser("VENUE_GUEST_SERVICES"), "video.playback.view")).toBe(false);
    expect(defaultPermissionForRole("dispatcher", "video.playback.view")).toBe(true);
    expect(defaultPermissionForRole("dispatcher", "video.clips.lock")).toBe(false);
    expect(defaultPermissionForRole("agencyit", "video.recording.configure")).toBe(true);
    expect(defaultPermissionForRole("agencyit", "video.playback.view")).toBe(false);
  });

  it("grants PTZ to wall operators and denies guest services", () => {
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY"), "video.ptz.control")).toBe(true);
    expect(auth.canPerform(makeUser("VENUE_OPERATOR"), "video.ptz.control")).toBe(true);
    expect(auth.canPerform(makeUser("VENUE_GUEST_SERVICES"), "video.ptz.control")).toBe(false);
    expect(defaultPermissionForRole("dispatcher", "video.ptz.control")).toBe(true);
    expect(defaultPermissionForRole("agencyit", "video.ptz.control")).toBe(false);
  });
});
