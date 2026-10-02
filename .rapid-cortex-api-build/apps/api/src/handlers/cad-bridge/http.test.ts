import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";
import { handler } from "./http.js";

vi.mock("../../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    enableCadBridge: true,
    cadBridgeConfigTable: "rapid-cortex-cad-bridge-config-test",
    cadBridgeMock: true,
    cadWritebackEnabled: false,
    auditTable: "audit",
    networkAccessEnforcement: false,
  },
}));

const { getConfig, putConfig } = vi.hoisted(() => ({
  getConfig: vi.fn(),
  putConfig: vi.fn(),
}));

vi.mock("../../cad-bridge/store.js", () => ({
  isCadBridgeStoreConfigured: () => true,
  cadBridgeStore: {
    getConfig,
    putConfig,
    getCircuitBreaker: vi.fn(async () => null),
    countBuffered: vi.fn(async () => 0),
    listConflicts: vi.fn(async () => []),
    listAudit: vi.fn(async () => []),
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

describe("CAD bridge admin HTTP", () => {
  beforeEach(() => {
    getConfig.mockReset();
    putConfig.mockReset();
    getConfig.mockResolvedValue(null);
  });

  it("returns 403 when a dispatcher cannot manage bridge config", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        rawPath: "/api/cad-bridge/config",
        routeKey: "PUT /api/cad-bridge/{proxy+}",
        body: JSON.stringify({ enabled: true, cadA: {}, cadB: {} }),
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns a default disabled config to agency admin", async () => {
    const event = makeAuthenticatedEvent({
      role: "agencyadmin",
      agencyId: "kcpd",
      rawPath: "/api/cad-bridge/config",
      routeKey: "GET /api/cad-bridge/{proxy+}",
    });
    const res = await invokeHttpHandler(handler, event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { config: { enabled: boolean }; brokerNotice: string };
    expect(body.config.enabled).toBe(false);
    expect(body.brokerNotice).toMatch(/broker, not the source of truth/i);
  });
});
