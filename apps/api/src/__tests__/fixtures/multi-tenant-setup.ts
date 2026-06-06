/**
 * Test fixtures and helpers for multi-tenant and cross-agency security scenarios.
 * Keep IDs readable so failures point to the intended boundary.
 */
import type { Incident, UserContext } from "rapid-cortex-shared";

export const TEST_AGENCY_A = "harris-tx";
export const TEST_AGENCY_B = "travis-tx";
export const TEST_INCIDENT_A = "inc_tenant_a_001";
export const TEST_INCIDENT_B = "inc_tenant_b_001";
export const TEST_USER_A = "cognito-user-a";
export const TEST_USER_B = "cognito-user-b";

export function makeTestIncident(overrides: { incidentId: string; agencyId: string } & Partial<Incident>): Incident {
  const now = new Date().toISOString();
  return {
    incidentId: overrides.incidentId,
    agencyId: overrides.agencyId,
    title: "Security test",
    category: "unknown",
    urgency: "moderate",
    status: "active",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeUserContext(partial: Pick<UserContext, "userId" | "agencyId" | "role"> & { email?: string }): UserContext {
  return {
    userId: partial.userId,
    agencyId: partial.agencyId,
    role: partial.role,
    email: partial.email ?? `${partial.userId}@fixture.test`,
  };
}

/** Minimal `createAgency` body matching the current `createAgencyBodySchema`. */
export function minimalCreateAgencyBody(agencyId: string) {
  return {
    agencyId,
    city: "Laredo",
    centerName: "Fixture PSAP",
    name: "Fixture Agency",
    type: "pilot" as const,
    state: "tx",
    region: "us-south",
    primaryContactName: "Fixture Admin",
    primaryContactEmail: "fixture-admin@test.example.org",
    deploymentMode: "side_by_side" as const,
    protocolPackId: "default",
    retentionPolicyId: "cjis-default",
    integrationMode: "demo_only" as const,
  };
}

/** Body for `addTranscriptChunk` (English text required for pipeline; tests mock the service in some paths). */
export function minimalTranscriptChunkBody() {
  return JSON.stringify({
    speaker: "caller",
    text: "This is a security boundary test segment.",
  });
}
