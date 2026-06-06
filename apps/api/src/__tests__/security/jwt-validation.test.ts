/**
 * G1 — JWT / session posture (in-process, no live fetch):
 * Protected Lambda handlers return 401 before business logic when the caller is anonymous
 * or presents a Bearer token that cannot be verified (no valid Cognito configuration in test).
 * Claim shape is asserted via API Gateway authorizer claims (same mapping as production JWT authorizer).
 */
import { afterEach, describe, expect, it } from "vitest";
import { getUserContext } from "../../lib/auth.js";
import { handler as analyzeIncidentHandler } from "../../handlers/analyzeIncident.js";
import { handler as getIncidentHandler } from "../../handlers/getIncident.js";
import { handler as listIncidentsHandler } from "../../handlers/listIncidents.js";
import { handler as listTranscriptHandler } from "../../handlers/listTranscript.js";
import { handler as qaHandler } from "../../handlers/qa/qaHttp.js";
import {
  invokeHttpHandler,
  makeAuthenticatedEvent,
  makeUnauthenticatedEvent,
} from "../../handlers/handlerTestUtils.js";

describe("G1: JWT claim validation & anonymous access (fail closed)", () => {
  const prevCognitoRegion = process.env.COGNITO_REGION;
  const prevCognitoClientId = process.env.COGNITO_CLIENT_ID;

  afterEach(() => {
    if (prevCognitoRegion === undefined) delete process.env.COGNITO_REGION;
    else process.env.COGNITO_REGION = prevCognitoRegion;
    if (prevCognitoClientId === undefined) delete process.env.COGNITO_CLIENT_ID;
    else process.env.COGNITO_CLIENT_ID = prevCognitoClientId;
  });

  const anonymousMatrix: Array<{
    label: string;
    routeKey: string;
    rawPath: string;
    pathParameters?: Record<string, string>;
    body?: string;
  }> = [
    { label: "list incidents", routeKey: "GET /api/incidents", rawPath: "/api/incidents" },
    {
      label: "get incident",
      routeKey: "GET /api/incidents/{id}",
      rawPath: "/api/incidents/inc-test-1",
      pathParameters: { id: "inc-test-1" },
    },
    {
      label: "analyze incident",
      routeKey: "POST /api/incidents/{id}/analyze",
      rawPath: "/api/incidents/inc-test-1/analyze",
      pathParameters: { id: "inc-test-1" },
      body: "{}",
    },
    {
      label: "list transcript",
      routeKey: "GET /api/incidents/{id}/transcripts",
      rawPath: "/api/incidents/inc-test-1/transcripts",
      pathParameters: { id: "inc-test-1" },
    },
    { label: "QA templates", routeKey: "GET /api/qa/templates", rawPath: "/api/qa/templates" },
  ];

  it.each(anonymousMatrix)("returns 401 for missing credentials — $label", async (row) => {
    const event = makeUnauthenticatedEvent({
      routeKey: row.routeKey,
      rawPath: row.rawPath,
      pathParameters: row.pathParameters,
      body: row.body,
    });

    const handler = pickHandler(row.routeKey);
    const res = await invokeHttpHandler(handler, event);
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  it.each(anonymousMatrix)("returns 401 for unverifiable Bearer token — $label", async (row) => {
    delete process.env.COGNITO_REGION;
    delete process.env.COGNITO_CLIENT_ID;

    const event = makeUnauthenticatedEvent({
      routeKey: row.routeKey,
      rawPath: row.rawPath,
      pathParameters: row.pathParameters,
      body: row.body,
      headers: { Authorization: "Bearer definitely-not-a-valid-signed-jwt" },
    });

    const handler = pickHandler(row.routeKey);
    const res = await invokeHttpHandler(handler, event);
    expect(res.statusCode).toBe(401);
  });

  it("maps authorizer JWT claims to user context (dispatcher)", async () => {
    const event = makeAuthenticatedEvent({
      role: "dispatcher",
      agencyId: "agency_001",
      userId: "user-d1",
      email: "dispatcher@agency.test",
      rawPath: "/api/incidents",
      routeKey: "GET /api/incidents",
    });
    const user = await getUserContext(event);
    expect(user).toMatchObject({
      userId: "user-d1",
      agencyId: "agency_001",
      role: "dispatcher",
      email: "dispatcher@agency.test",
    });
  });

  it("inactive account is not admitted as an authenticated session (fail closed)", async () => {
    const res = await invokeHttpHandler(
      listIncidentsHandler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency_001",
        accountStatus: "suspended",
        rawPath: "/api/incidents",
        routeKey: "GET /api/incidents",
      }),
    );
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  });
});

function pickHandler(routeKey: string) {
  if (routeKey === "GET /api/incidents") return listIncidentsHandler;
  if (routeKey === "GET /api/incidents/{id}") return getIncidentHandler;
  if (routeKey === "POST /api/incidents/{id}/analyze") return analyzeIncidentHandler;
  if (routeKey === "GET /api/incidents/{id}/transcripts") return listTranscriptHandler;
  if (routeKey.startsWith("GET /api/qa/") || routeKey.startsWith("POST /api/qa/")) return qaHandler;
  throw new Error(`Unhandled routeKey in jwt-validation.test: ${routeKey}`);
}
