import { describe, expect, it, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const getUserContext = vi.fn();
const isUserAccountActive = vi.fn(() => true);

vi.mock("../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: () => null,
}));

vi.mock("./cameras/transit-camera-http.js", () => ({
  tryHandleTransitCameraHttp: vi.fn(async () => null),
}));

vi.mock("../../transit/transit-service.js", () => ({
  getDashboard: vi.fn(async () => ({ stats: { vehiclesInService: 1 } })),
  listVehicles: vi.fn(async () => []),
  createIncident: vi.fn(async () => ({ incidentId: "tinc_1" })),
}));

import { handler } from "./transitHttp.js";

function makeEvent(
  method: string,
  path: string,
  params: Record<string, string>,
  user: UserContext | null,
): APIGatewayProxyEventV2 {
  getUserContext.mockResolvedValue(user);
  return {
    version: "2.0",
    routeKey: `${method} ${path.replace(/test-transit-hvt/, "{agencyId}")}`,
    rawPath: path,
    pathParameters: params,
    requestContext: {
      http: { method, path },
    } as APIGatewayProxyEventV2["requestContext"],
    headers: {},
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const transitUser: UserContext = {
  userId: "u-sec",
  agencyId: "test-transit-hvt",
  role: "transit_security",
  email: "sec@hvt.example",
};

const dispatcher: UserContext = {
  userId: "u-disp",
  agencyId: "test-transit-hvt",
  role: "dispatcher",
  email: "disp@example.com",
};

describe("transitHttp RBAC", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    isUserAccountActive.mockReturnValue(true);
  });

  it("returns 403 when a PSAP dispatcher hits the transit dashboard", async () => {
    const event = makeEvent(
      "GET",
      "/api/transit/test-transit-hvt/dashboard",
      { agencyId: "test-transit-hvt" },
      dispatcher,
    );
    const result = await handler(event);
    const res = result as { statusCode: number };
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when agencyId does not match the session", async () => {
    const event = makeEvent(
      "GET",
      "/api/transit/other-agency/dashboard",
      { agencyId: "other-agency" },
      transitUser,
    );
    const result = await handler(event);
    const res = result as { statusCode: number };
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 for transit_security dashboard", async () => {
    const event = makeEvent(
      "GET",
      "/api/transit/test-transit-hvt/dashboard",
      { agencyId: "test-transit-hvt" },
      transitUser,
    );
    const result = await handler(event);
    const res = result as { statusCode: number };
    expect(res.statusCode).toBe(200);
  });
});
