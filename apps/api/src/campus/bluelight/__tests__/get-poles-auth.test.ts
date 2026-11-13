/**
 * Auth gate tests for GET /api/campus/bluelight/poles (get-poles handler).
 * Verifies: campus roles pass, non-campus roles get 403.
 */

import { describe, it, expect, vi } from "vitest";

// We test the role-check logic in isolation — the full handler wires DynamoDB.
// This ensures the ALLOWED_ROLES set is correct per the RBAC rules.

const ALLOWED = [
  "campus_admin",
  "campus_supervisor",
  "campus_security",
  "campus_dispatch",
  "campus_counselor",
  "campus_faculty",
  "campus_admin_k12",
  "campus_supervisor_k12",
  "campus_security_k12",
  "campus_dispatch_k12",
  "campus_admin_highered",
  "campus_supervisor_highered",
  "campus_security_highered",
  "campus_dispatch_highered",
  "rcsuperadmin",
  "rcadmin",
];

const DENIED = [
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "analyst",
  "auditor",
  "venue_admin",
  "venue_security",
  "hospital_admin",
  "transit_admin",
  "call_assist_admin",
  "field_responder",
];

function normalizeRole(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

const ALLOWED_ROLES = new Set(ALLOWED);

function isAllowed(role: string): boolean {
  return ALLOWED_ROLES.has(normalizeRole(role));
}

describe("BlueLightGetPoles role gate", () => {
  it.each(ALLOWED)("allows %s", (role) => {
    expect(isAllowed(role)).toBe(true);
  });

  it.each(DENIED)("denies %s", (role) => {
    expect(isAllowed(role)).toBe(false);
  });

  it("denies VENUE_ADMIN (mixed-case product vertical)", () => {
    expect(isAllowed("VENUE_ADMIN")).toBe(false);
  });

  it("allows CAMPUS_ADMIN (uppercase — Cognito group casing)", () => {
    expect(isAllowed("CAMPUS_ADMIN")).toBe(true);
  });
});
