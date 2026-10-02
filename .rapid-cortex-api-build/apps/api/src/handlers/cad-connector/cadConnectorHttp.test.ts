import { describe, expect, it, vi } from "vitest";
import { cadConnectorEnabled } from "./cadConnectorFlag.js";

vi.mock("rapid-cortex-integrations/cad", () => ({
  CadAdapterRegistry: { resolve: vi.fn() },
  CadRoutingEngine: { resolve: vi.fn() },
  cadConnectorAuditStore: { append: vi.fn(), list: vi.fn() },
  cadConnectorService: { list: vi.fn(), get: vi.fn() },
  cadIngestionService: { ingestConnector: vi.fn() },
  cadUnifiedIncidentStore: { get: vi.fn(), list: vi.fn() },
  cadWriteBackStore: { put: vi.fn(), get: vi.fn(), list: vi.fn() },
  newWriteBackId: () => "cwb_x",
  sanitizeConnectorForClient: (c: unknown) => c,
  stripRawVendorPayload: (c: unknown) => c,
}));
vi.mock("../../../../../packages/integrations/cad/index.ts", () => ({
  CadAdapterRegistry: { resolve: vi.fn() },
  CadRoutingEngine: { resolve: vi.fn() },
  cadConnectorAuditStore: { append: vi.fn(), list: vi.fn() },
  cadConnectorService: { list: vi.fn(), get: vi.fn() },
  cadIngestionService: { ingestConnector: vi.fn() },
  cadUnifiedIncidentStore: { get: vi.fn(), list: vi.fn() },
  cadWriteBackStore: { put: vi.fn(), get: vi.fn(), list: vi.fn() },
  newWriteBackId: () => "cwb_x",
  sanitizeConnectorForClient: (c: unknown) => c,
  stripRawVendorPayload: (c: unknown) => c,
}));
vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: class DynamoDBClient {} }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: vi.fn() }) },
  GetCommand: class GetCommand {},
  PutCommand: class PutCommand {},
  QueryCommand: class QueryCommand {},
  ScanCommand: class ScanCommand {},
  UpdateCommand: class UpdateCommand {},
}));
vi.mock("@aws-sdk/client-kms", () => ({
  KMSClient: class KMSClient {},
  EncryptCommand: class EncryptCommand {},
  DecryptCommand: class DecryptCommand {},
}));
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class SecretsManagerClient {},
  CreateSecretCommand: class CreateSecretCommand {},
  GetSecretValueCommand: class GetSecretValueCommand {},
  PutSecretValueCommand: class PutSecretValueCommand {},
}));

describe("cadConnectorEnabled", () => {
  it("is fail-closed unless explicitly true/1", () => {
    vi.stubEnv("ENABLE_CAD_CONNECTOR", "");
    expect(cadConnectorEnabled()).toBe(false);
    vi.stubEnv("ENABLE_CAD_CONNECTOR", "false");
    expect(cadConnectorEnabled()).toBe(false);
    vi.stubEnv("ENABLE_CAD_CONNECTOR", "true");
    expect(cadConnectorEnabled()).toBe(true);
    vi.stubEnv("ENABLE_CAD_CONNECTOR", "1");
    expect(cadConnectorEnabled()).toBe(true);
  });
});

describe("cadConnectorHttp feature flag", () => {
  it("returns 503 when ENABLE_CAD_CONNECTOR is off", async () => {
    vi.stubEnv("ENABLE_CAD_CONNECTOR", "false");
    const { handler } = await import("./cadConnectorHttp.js");
    const result = await handler(
      {
        rawPath: "/api/cad-connector/connectors",
        routeKey: "GET /api/cad-connector/connectors",
        requestContext: { http: { method: "GET" } },
      } as never,
      {} as never,
      () => undefined,
    );
    const res = result as { statusCode: number; body: string };
    expect(res.statusCode).toBe(503);
    expect(res.body).toContain("not enabled");
  });
});
