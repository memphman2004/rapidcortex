import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { makeUnauthenticatedEvent, invokeHttpHandler, makeAuthenticatedEvent } from "../../handlerTestUtils.js";
import { DECEPTION_IMPORT_DENYLIST } from "../assertDeceptionIsolation.js";
import { sanitizeHeaders, sanitizePayload, sanitizeQuery } from "../sanitize.js";
import type { DeceptionEvent } from "../deceptionEvent.js";
import { handler as deceptionEventsDashboardHandler } from "../../admin/deceptionEventsHttp.js";

const mockPutDeceptionEvent = vi.hoisted(() => vi.fn(async () => {}));
const mockQueryEventsBySourceIpSince = vi.hoisted(() => vi.fn(async () => []));
const mockCountHoneytokenEventsByIpSince = vi.hoisted(() => vi.fn(async () => 0));
const mockSnsSend = vi.hoisted(() => vi.fn());

vi.mock("../deceptionDynamo.js", () => ({
  putDeceptionEvent: (...args: unknown[]) => mockPutDeceptionEvent(...args),
  queryEventsBySourceIpSince: (...args: unknown[]) => mockQueryEventsBySourceIpSince(...args),
  countHoneytokenEventsByIpSince: (...args: unknown[]) => mockCountHoneytokenEventsByIpSince(...args),
  scanRecentDeceptionEvents: vi.fn(),
}));

vi.mock("../../../repositories/deceptionEventsRepository.js", () => ({
  DeceptionEventsRepository: class {
    async listRecent() {
      return [];
    }
  },
}));

vi.mock("@aws-sdk/client-sns", () => {
  class SNSClientStub {
    send = mockSnsSend;
    constructor(_opts?: unknown) {}
  }
  class PublishCommandStub {
    constructor(public input?: unknown) {}
  }
  return { SNSClient: SNSClientStub, PublishCommand: PublishCommandStub };
});

describe("Deception Shield", () => {
  const deceptionSrcDir = join(__dirname, "..");

  beforeEach(() => {
    mockPutDeceptionEvent.mockClear();
    mockQueryEventsBySourceIpSince.mockReset();
    mockQueryEventsBySourceIpSince.mockResolvedValue([]);
    mockCountHoneytokenEventsByIpSince.mockReset();
    mockCountHoneytokenEventsByIpSince.mockResolvedValue(0);
    mockSnsSend.mockReset();
    process.env.DECEPTION_EVENTS_TABLE ??= "test-deception-events";
    process.env.DECEPTION_SHIELD_ENABLED = "true";
    process.env.DECEPTION_ALERTS_ENABLED = "true";
    process.env.OPS_ALERTS_TOPIC_ARN ??= "";
  });

  afterEach(() => {
    vi.resetModules();
  });

  function decoyPaths(): readonly string[] {
    return [
      "/api/internal/cad-sync",
      "/api/internal/cad-writeback",
      "/api/internal/ncic-gateway",
      "/api/internal/agency-root",
      "/api/admin-backup",
      "/api/rc-lite/root",
      "/api/system/secrets",
      "/api/debug/env",
      "/api/v1/cad/export-test",
    ] as const;
  }

  async function invokeDecoy(
    opts: Omit<Partial<APIGatewayProxyEventV2>, "requestContext"> & {
      routeKey?: string;
      rawPath?: string;
    },
  ) {
    vi.resetModules();
    const mod = await import("../deceptionDecoyHttp.js");
    const event = makeUnauthenticatedEvent({
      routeKey: opts.routeKey ?? "GET /decoy",
      rawPath: opts.rawPath ?? "/decoy",
      headers: opts.headers,
      body: opts.body ?? undefined,
    });
    Object.assign(event, {
      ...(opts.queryStringParameters != null ? { queryStringParameters: opts.queryStringParameters } : {}),
    });
    event.requestContext = {
      ...(event.requestContext as object),
      http: {
        method: (opts.routeKey ?? "GET").split(" ")[0] ?? "GET",
        sourceIp: "198.51.100.42",
      },
    } as APIGatewayProxyEventV2["requestContext"];

    const res = await mod.handler(event, {} as never, () => {});
    return res!;
  }

  it("each decoy path returns fake data and HTTP 200 when shield is enabled", async () => {
    for (const p of decoyPaths()) {
      mockPutDeceptionEvent.mockClear();
      const routeKey =
        p === "/api/internal/cad-sync" || p === "/api/internal/cad-writeback" ? `POST ${p}` : `GET ${p}`;
      const res = await invokeDecoy({ rawPath: p, routeKey });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body ?? "{}") as Record<string, unknown>;
      expect(Object.keys(json).length).toBeGreaterThan(0);
      expect(mockPutDeceptionEvent).toHaveBeenCalledTimes(1);
    }
  });

  it("decoy Lambda source does not import production service paths (isolation snippets)", () => {
    const files = readdirSync(deceptionSrcDir).filter((f) => {
      if (!f.endsWith(".ts")) return false;
      if (f.endsWith(".test.ts")) return false;
      return true;
    });
    for (const name of files) {
      if (name === "assertDeceptionIsolation.ts") continue;
      const text = readFileSync(join(deceptionSrcDir, name), "utf8");
      for (const bad of DECEPTION_IMPORT_DENYLIST) {
        expect(text.includes(bad), `${name} must not contain ${bad}`).toBe(false);
      }
    }
  });

  it("persists a DeceptionEvent on every decoy hit", async () => {
    mockPutDeceptionEvent.mockClear();
    await invokeDecoy({
      routeKey: "GET /api/debug/env",
      rawPath: "/api/debug/env",
    });
    expect(mockPutDeceptionEvent).toHaveBeenCalledTimes(1);
    const arg = mockPutDeceptionEvent.mock.calls[0][0] as DeceptionEvent;
    expect(arg.eventType).toBe("DECOY_ROUTE_HIT");
    expect(arg.route).toBe("/api/debug/env");
    expect(typeof arg.payloadSummary).toBe("string");
    expect(typeof arg.headersSummary).toBe("string");
  });

  it("honeytoken in Authorization header persists HIGH-risk HONEYTOKEN_USED", async () => {
    vi.resetModules();
    const { detectHoneytokenBlock } = await import("../honeytokenGate.js");
    const { HONEYTOKENS } = await import("../fakeData.js");

    mockPutDeceptionEvent.mockClear();
    const hdr = `Bearer ${HONEYTOKENS.RC_LITE_API_KEY}`;
    const event = makeUnauthenticatedEvent({
      routeKey: "GET /api/incidents",
      rawPath: "/api/incidents",
      headers: { authorization: hdr, "user-agent": "Mozilla/5.0" },
    });
    event.requestContext = {
      requestId: "vitest-honeytoken",
      http: { method: "GET", path: "/api/incidents", sourceIp: "203.0.113.77" },
    } as APIGatewayProxyEventV2["requestContext"];

    await detectHoneytokenBlock(event);
    expect(mockPutDeceptionEvent).toHaveBeenCalledTimes(1);
    const saved = mockPutDeceptionEvent.mock.calls[0][0] as DeceptionEvent;
    expect(saved.eventType).toBe("HONEYTOKEN_USED");
    expect(saved.riskLevel).toBe("HIGH");
    expect(saved.honeytokenUsed).toBe("RC_LITE_API_KEY");
  });

  it("honeytoken in JSON body persists HONEYTOKEN_USED at HIGH risk", async () => {
    vi.resetModules();
    const { detectHoneytokenBlock } = await import("../honeytokenGate.js");
    const { HONEYTOKENS } = await import("../fakeData.js");

    mockPutDeceptionEvent.mockClear();
    const event = makeUnauthenticatedEvent({
      routeKey: "POST /api/incidents",
      rawPath: "/api/incidents",
      body: JSON.stringify({ note: "x", credential: HONEYTOKENS.ADMIN_BACKUP_TOKEN }),
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    });
    event.requestContext = {
      requestId: "vitest-body",
      http: { method: "POST", path: "/api/incidents", sourceIp: "203.0.113.10" },
    } as APIGatewayProxyEventV2["requestContext"];

    await detectHoneytokenBlock(event);
    expect(mockPutDeceptionEvent).toHaveBeenCalled();
    const saved = mockPutDeceptionEvent.mock.calls[0][0] as DeceptionEvent;
    expect(saved.eventType).toBe("HONEYTOKEN_USED");
    expect(saved.riskLevel).toBe("HIGH");
  });

  it("same IP with prior decoy + auth context touch scores CRITICAL on next decoy hit", async () => {
    const prior = [
      {
        id: "p1",
        eventType: "AUTH_CONTEXT_TOUCH" as const,
        riskLevel: "LOW" as const,
        route: "/api/mock",
        method: "GET",
        sourceIp: "198.51.100.42",
        userAgent: "Mozilla/5.0",
        requestFingerprint: "fp",
        payloadSummary: "",
        headersSummary: "{}",
        querySummary: "",
        correlationId: "c1",
        touchedRealRouteRecently: false,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        ttl: 0,
      },
    ];

    mockQueryEventsBySourceIpSince.mockResolvedValue(prior);

    mockPutDeceptionEvent.mockClear();
    const res = await invokeDecoy({
      routeKey: "GET /api/system/secrets",
      rawPath: "/api/system/secrets",
      headers: { "user-agent": "Mozilla/5.0" },
    });
    expect(res.statusCode).toBe(200);
    const saved = mockPutDeceptionEvent.mock.calls.at(-1)?.[0] as DeceptionEvent;
    expect(saved.riskLevel).toBe("CRITICAL");
    expect(saved.eventType).toBe("DECOY_ROUTE_HIT");
  });

  it("sanitizeHeaders keeps names but strips Authorization secrets", () => {
    const s = sanitizeHeaders({
      Authorization: "Bearer eyJ.secret",
      "X-Forwarded-For": "1.2.3.4",
      Cookie: "session=sekret",
      "Content-Type": "application/json",
    });
    expect(s).toContain("Authorization");
    expect(s).toContain("[REDACTED]");
    expect(s).not.toContain("eyJ.secret");
    expect(s).not.toContain("sekret");
  });

  it("sanitizePayload redacts nested keys matching token/secret naming", () => {
    expect(sanitizePayload(JSON.stringify({ name: "x", apiSecret: "s3cr3t", ok: true }))).toContain(
      "[REDACTED]",
    );
  });

  it("sanitizeQuery redacts suspicious query keys", () => {
    expect(sanitizeQuery({ client_id: "1", oauth_token: "abc" })).toContain("[REDACTED]");
  });

  it("GET deception-events returns 403 for dispatcher, supervisor, and staff roles", async () => {
    for (const role of ["dispatcher", "commsupervisor", "auditor"] as const) {
      const ev = makeAuthenticatedEvent({
        role,
        agencyId: "agency-a",
        rawPath: "/api/admin/security/deception-events",
        routeKey: "GET /api/admin/security/deception-events",
      });

      const res = await invokeHttpHandler(deceptionEventsDashboardHandler, ev);
      expect(res.statusCode).toBe(403);
    }
  });

  it("sendSecurityAlert does not throw when SNS publish fails (graceful degradation)", async () => {
    mockSnsSend.mockRejectedValueOnce(new Error("SNS_UNAVAILABLE"));
    process.env.DECEPTION_ALERTS_ENABLED = "true";
    process.env.OPS_ALERTS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:fake";

    vi.resetModules();
    const { sendSecurityAlert } = await import("../alerting.js");

    const ev: DeceptionEvent = {
      id: "x",
      eventType: "HONEYTOKEN_USED",
      riskLevel: "HIGH",
      route: "/t",
      method: "POST",
      sourceIp: "198.51.100.88",
      userAgent: "",
      requestFingerprint: "fp",
      payloadSummary: "",
      headersSummary: "{}",
      querySummary: "",
      correlationId: "corr",
      touchedRealRouteRecently: false,
      createdAt: new Date().toISOString(),
      ttl: 0,
    };

    await expect(sendSecurityAlert(ev)).resolves.toBeUndefined();
  });

  it("DECEPTION_SHIELD_ENABLED=false yields 404 for decoys and skips persistence", async () => {
    process.env.DECEPTION_SHIELD_ENABLED = "false";

    mockPutDeceptionEvent.mockClear();
    const res = await invokeDecoy({ routeKey: "GET /api/debug/env", rawPath: "/api/debug/env" });
    expect(res.statusCode).toBe(404);
    expect(mockPutDeceptionEvent).not.toHaveBeenCalled();
  });

  it("POST /api/internal/ncic-gateway decoy persists CRITICAL risk classification", async () => {
    mockPutDeceptionEvent.mockClear();
    const routeKey = "POST /api/internal/ncic-gateway";
    const res = await invokeDecoy({
      routeKey,
      rawPath: "/api/internal/ncic-gateway",
    });
    expect(res.statusCode).toBe(200);
    const saved = mockPutDeceptionEvent.mock.calls[0][0] as DeceptionEvent;
    expect(saved.eventType).toBe("DECOY_ROUTE_HIT");
    expect(saved.riskLevel).toBe("CRITICAL");
  });
});
