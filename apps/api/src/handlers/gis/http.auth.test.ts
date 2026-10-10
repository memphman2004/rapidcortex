import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserContext = vi.fn();
const isUserAccountActive = vi.fn();
const discoverGis = vi.fn();
const importGisDataset = vi.fn();
const listGisLayers = vi.fn();

vi.mock("../../lib/auth.js", () => ({
  getUserContext: (...a: unknown[]) => getUserContext(...a),
  isUserAccountActive: (...a: unknown[]) => isUserAccountActive(...a),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../lib/env.js", () => ({
  env: { enableGis: true },
}));

vi.mock("../../lib/ids.js", () => ({
  makeId: () => "audit1",
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../../gis/service.js", () => ({
  discoverGis: (...a: unknown[]) => discoverGis(...a),
  importGisDataset: (...a: unknown[]) => importGisDataset(...a),
  approveGisDataset: vi.fn(),
  listGisDatasets: vi.fn(),
  listGisLayers: (...a: unknown[]) => listGisLayers(...a),
  getGisDatasetGeoJson: vi.fn(),
  spatialContext: vi.fn(),
}));

function event(method: string, path: string, body?: unknown) {
  return {
    rawPath: path,
    body: body ? JSON.stringify(body) : undefined,
    queryStringParameters: {},
    requestContext: { http: { method, path } },
  } as never;
}

describe("GIS HTTP authz", () => {
  let handler: typeof import("./http.js").handler;

  beforeAll(async () => {
    ({ handler } = await import("./http.js"));
  }, 60_000);

  beforeEach(() => {
    vi.clearAllMocks();
    isUserAccountActive.mockReturnValue(true);
  });

  it("returns 401 without user", async () => {
    getUserContext.mockResolvedValue(null);
    const res = await handler(event("GET", "/api/gis/discover"), {} as never, () => undefined);
    expect((res as { statusCode: number }).statusCode).toBe(401);
  });

  it("returns 403 for dispatcher on discover", async () => {
    getUserContext.mockResolvedValue({
      userId: "d1",
      agencyId: "a1",
      role: "dispatcher",
    });
    const res = await handler(event("GET", "/api/gis/discover"), {} as never, () => undefined);
    expect((res as { statusCode: number }).statusCode).toBe(403);
  });

  it("allows agencyadmin discover", async () => {
    getUserContext.mockResolvedValue({
      userId: "adm",
      agencyId: "a1",
      role: "agencyadmin",
    });
    discoverGis.mockResolvedValue({ candidates: [] });
    const res = await handler(event("GET", "/api/gis/discover"), {} as never, () => undefined);
    expect((res as { statusCode: number }).statusCode).toBe(200);
  });

  it("allows dispatcher to list layers", async () => {
    getUserContext.mockResolvedValue({
      userId: "d1",
      agencyId: "a1",
      role: "dispatcher",
    });
    listGisLayers.mockResolvedValue([]);
    const res = await handler(event("GET", "/api/gis/layers"), {} as never, () => undefined);
    expect((res as { statusCode: number }).statusCode).toBe(200);
  });
});
