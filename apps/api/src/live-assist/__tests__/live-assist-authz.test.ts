/**
 * Live Assist authorization tests.
 *
 * Verifies:
 *   - Correct roles can view, coach, and admin
 *   - Cross-tenant access is always denied
 *   - Dispatchers can view but NOT coach
 *   - Auditors can view but NOT coach
 */
import { describe, expect, it } from "vitest";
import {
  canViewLiveAssist,
  canCoachLiveAssist,
  canAdminLiveAssist,
} from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";

function user(role: string, agencyId = "agency-1"): UserContext {
  return { userId: "u1", role, agencyId, email: "u@test.com" } as unknown as UserContext;
}

const AGENCY = "agency-1";
const OTHER_AGENCY = "agency-999";

describe("canViewLiveAssist", () => {
  it("allows dispatcher", () => expect(canViewLiveAssist(user("dispatcher"), AGENCY)).toBe(true));
  it("allows supervisor", () => expect(canViewLiveAssist(user("supervisor"), AGENCY)).toBe(true));
  it("allows agencyadmin", () => expect(canViewLiveAssist(user("agencyadmin"), AGENCY)).toBe(true));
  it("allows auditor", () => expect(canViewLiveAssist(user("auditor"), AGENCY)).toBe(true));
  it("allows analyst", () => expect(canViewLiveAssist(user("analyst"), AGENCY)).toBe(true));
  it("allows campus_admin", () => expect(canViewLiveAssist(user("CAMPUS_ADMIN"), AGENCY)).toBe(true));
  it("allows transit_security", () => expect(canViewLiveAssist(user("TRANSIT_SECURITY"), AGENCY)).toBe(true));
  it("allows rcsuperadmin cross-tenant", () => expect(canViewLiveAssist(user("rcsuperadmin", OTHER_AGENCY), AGENCY)).toBe(true));
  it("denies cross-agency dispatcher", () => expect(canViewLiveAssist(user("dispatcher", OTHER_AGENCY), AGENCY)).toBe(false));
  it("denies unknown role", () => expect(canViewLiveAssist(user("unknown_role"), AGENCY)).toBe(false));
});

describe("canCoachLiveAssist", () => {
  it("allows supervisor", () => expect(canCoachLiveAssist(user("supervisor"), AGENCY)).toBe(true));
  it("allows agencyadmin", () => expect(canCoachLiveAssist(user("agencyadmin"), AGENCY)).toBe(true));
  it("allows campus_supervisor", () => expect(canCoachLiveAssist(user("CAMPUS_SUPERVISOR"), AGENCY)).toBe(true));
  it("allows transit_admin", () => expect(canCoachLiveAssist(user("TRANSIT_ADMIN"), AGENCY)).toBe(true));
  it("denies dispatcher (view-only for coaching)", () => expect(canCoachLiveAssist(user("dispatcher"), AGENCY)).toBe(false));
  it("denies auditor", () => expect(canCoachLiveAssist(user("auditor"), AGENCY)).toBe(false));
  it("denies analyst", () => expect(canCoachLiveAssist(user("analyst"), AGENCY)).toBe(false));
  it("denies cross-agency supervisor", () => expect(canCoachLiveAssist(user("supervisor", OTHER_AGENCY), AGENCY)).toBe(false));
});

describe("canAdminLiveAssist", () => {
  it("allows agencyadmin", () => expect(canAdminLiveAssist(user("agencyadmin"), AGENCY)).toBe(true));
  it("allows agencyit", () => expect(canAdminLiveAssist(user("agencyit"), AGENCY)).toBe(true));
  it("allows campus_admin", () => expect(canAdminLiveAssist(user("CAMPUS_ADMIN"), AGENCY)).toBe(true));
  it("allows rcsuperadmin cross-tenant", () => expect(canAdminLiveAssist(user("rcsuperadmin", OTHER_AGENCY), AGENCY)).toBe(true));
  it("denies supervisor (can coach but not configure providers)", () => expect(canAdminLiveAssist(user("supervisor"), AGENCY)).toBe(false));
  it("denies dispatcher", () => expect(canAdminLiveAssist(user("dispatcher"), AGENCY)).toBe(false));
  it("denies cross-agency agencyadmin", () => expect(canAdminLiveAssist(user("agencyadmin", OTHER_AGENCY), AGENCY)).toBe(false));
});
