import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const getUserContext = vi.fn();
const listTransitCameras = vi.fn();
const createTransitCamera = vi.fn();

vi.mock("../../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: () => true,
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: () => null,
}));

vi.mock("./transit-camera-registry-service.js", () => ({
  listTransitCameras: (...args: unknown[]) => listTransitCameras(...args),
  createTransitCamera: (...args: unknown[]) => createTransitCamera(...args),
  getCamerasForTransitPlace: vi.fn(async () => []),
  updateTransitCamera: vi.fn(),
  deleteTransitCamera: vi.fn(),
  discoverTransitCamera: vi.fn(),
  recordTransitProducerAgentHeartbeat: vi.fn(),
  buildTransitProducerConfigYaml: vi.fn(() => "cameras:\n"),
  transitCameraRegistryRepo: {
    listByAgency: vi.fn(async () => []),
    get: vi.fn(async () => null),
  },
}));

vi.mock("../../../shared/kvs-channel-service.js", () => ({
  KvsChannelService: class {
    issueViewerToken = vi.fn();
  },
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn(async () => undefined);
  },
}));

vi.mock("../../../lib/runtimeSecrets.js", () => ({
  resolvePlainOrSecretArn: vi.fn(async () => ""),
}));

import { tryHandleTransitCameraHttp } from "./transit-camera-http.js";

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
    queryStringParameters: null,
    requestContext: {
      http: { method, path },
    } as APIGatewayProxyEventV2["requestContext"],
    headers: {},
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const security: UserContext = {
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

const admin: UserContext = {
  userId: "u-admin",
  agencyId: "test-transit-hvt",
  role: "transit_admin",
  email: "admin@hvt.example",
};

describe("transit camera HTTP RBAC", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    listTransitCameras.mockReset();
    createTransitCamera.mockReset();
    listTransitCameras.mockResolvedValue([]);
    process.env.ENABLE_TRANSIT_CAMERAS = "true";
  });

  it("returns 403 when a PSAP dispatcher lists transit cameras", async () => {
    const event = makeEvent(
      "GET",
      "/api/transit/test-transit-hvt/cameras/registry",
      { agencyId: "test-transit-hvt" },
      dispatcher,
    );
    const result = await tryHandleTransitCameraHttp(event);
    expect((result as { statusCode: number }).statusCode).toBe(403);
  });

  it("allows transit security to view the registry", async () => {
    const event = makeEvent(
      "GET",
      "/api/transit/test-transit-hvt/cameras/registry",
      { agencyId: "test-transit-hvt" },
      security,
    );
    const result = await tryHandleTransitCameraHttp(event);
    expect((result as { statusCode: number }).statusCode).toBe(200);
  });

  it("denies transit security registry writes", async () => {
    const event = makeEvent(
      "POST",
      "/api/transit/test-transit-hvt/cameras/registry",
      { agencyId: "test-transit-hvt" },
      security,
    );
    event.body = JSON.stringify({
      displayName: "Bus 14 rear",
      vendor: "onvif",
      sections: ["bus-14"],
      priorityRank: 1,
      ptzCapable: false,
      rtspUrl: "rtsp://10.0.0.8/stream1",
    });
    const result = await tryHandleTransitCameraHttp(event);
    expect((result as { statusCode: number }).statusCode).toBe(403);
    expect(createTransitCamera).not.toHaveBeenCalled();
  });

  it("allows transit admin to create a registry camera", async () => {
    createTransitCamera.mockResolvedValue({ cameraId: "cam-1" });
    const event = makeEvent(
      "POST",
      "/api/transit/test-transit-hvt/cameras/registry",
      { agencyId: "test-transit-hvt" },
      admin,
    );
    event.body = JSON.stringify({
      displayName: "Bus 14 rear",
      vendor: "onvif",
      sections: ["bus-14"],
      priorityRank: 1,
      ptzCapable: false,
      rtspUrl: "rtsp://10.0.0.8/stream1",
    });
    const result = await tryHandleTransitCameraHttp(event);
    expect((result as { statusCode: number }).statusCode).toBe(200);
    expect(createTransitCamera).toHaveBeenCalled();
  });

  it("returns 404 when transit cameras are disabled", async () => {
    process.env.ENABLE_TRANSIT_CAMERAS = "0";
    const event = makeEvent(
      "GET",
      "/api/transit/test-transit-hvt/cameras/registry",
      { agencyId: "test-transit-hvt" },
      admin,
    );
    const result = await tryHandleTransitCameraHttp(event);
    expect((result as { statusCode: number }).statusCode).toBe(404);
  });
});
