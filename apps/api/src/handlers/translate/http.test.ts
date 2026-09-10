import { beforeEach, describe, expect, it, vi } from "vitest";

const { putSession, getSession, listByAgencyStatus, listSegments } = vi.hoisted(() => ({
  putSession: vi.fn(),
  getSession: vi.fn(),
  listByAgencyStatus: vi.fn(),
  listSegments: vi.fn(),
}));

vi.mock("../../translate/store.js", () => ({
  translateStore: {
    putSession,
    getSession,
    listByAgencyStatus,
    listSegments,
    incrementSegmentCount: vi.fn(),
    putSegment: vi.fn(),
    putConnection: vi.fn(),
    getConnection: vi.fn(),
    deleteConnection: vi.fn(),
    listConnections: vi.fn(async () => []),
  },
}));

vi.mock("../../middleware/requireAddon.js", () => ({
  requireAddon: () => async () => null,
  requireTranslateAddon: () => async () => null,
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

vi.mock("../../translate/ws-token.js", () => ({
  signTranslateWsToken: vi.fn(async () => "ws-token"),
  verifyTranslateWsToken: vi.fn(),
}));

vi.mock("../../translate/summary.js", () => ({
  generateSessionSummary: vi.fn(async () => "Summary"),
  formatTranscript: vi.fn(() => ""),
  mockSessionSummary: vi.fn(() => "Summary"),
}));

vi.mock("../../translate/writeback.js", () => ({
  queueVerticalWriteback: vi.fn(async () => ({ queued: false, cadQueued: false })),
  hasWritebackTarget: vi.fn(() => false),
}));

vi.mock("../../lib/smsFactoryEnv.js", () => ({
  buildSmsFactoryEnvForAgency: vi.fn(async () => ({})),
}));

vi.mock("../../services/sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: vi.fn(async () => ({ status: "sent", provider: "mock" })),
}));

vi.mock("../../lib/websocket/send-message.js", () => ({
  sendWebSocketMessage: vi.fn(),
}));

vi.mock("../../lib/env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/env.js")>();
  return {
    env: {
      ...mod.env,
      enableRcTranslate: true,
      translateSessionsTable: "test-translate-sessions",
      translateSegmentsTable: "test-translate-segments",
      translateConnectionsTable: "test-translate-connections",
      translateMock: true,
      cadWritebackEnabled: false,
      appPublicBaseUrl: "https://app.example.test",
      translateWsEndpoint: "wss://translate.example.test/dev",
    },
  };
});

import { handler } from "./http.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

describe("RC Translate HTTP", () => {
  beforeEach(() => {
    putSession.mockReset().mockResolvedValue(undefined);
    getSession.mockReset();
    listByAgencyStatus.mockReset().mockResolvedValue([]);
    listSegments.mockReset().mockResolvedValue([]);
  });

  it("creates a law-enforcement session for a dispatcher", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "POST /api/translate/{proxy+}",
        rawPath: "/api/translate/sessions",
        body: JSON.stringify({ subjectLanguage: "es" }),
      }),
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(String(res.body ?? "{}")) as {
      session: { vertical: string; officerId: string };
      wsEndpoint: string;
    };
    expect(body.session.vertical).toBe("law_enforcement");
    expect(body.session.officerId).toBe("test-user");
    expect(body.wsEndpoint).toContain("token=");
    expect(putSession).toHaveBeenCalled();
  });

  it("rejects a dispatcher starting a venue session", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "POST /api/translate/{proxy+}",
        rawPath: "/api/translate/sessions",
        body: JSON.stringify({ vertical: "venue", venueContext: { venueCode: "MBS" } }),
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(putSession).not.toHaveBeenCalled();
  });

  it("creates a venue session for VENUE_OPERATOR", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "VENUE_OPERATOR",
        agencyId: "mbs",
        routeKey: "POST /api/translate/{proxy+}",
        rawPath: "/api/translate/sessions",
        body: JSON.stringify({ vertical: "venue", venueContext: { venueCode: "MBS" } }),
      }),
    );
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(String(res.body ?? "{}")) as { session: { vertical: string } };
    expect(body.session.vertical).toBe("venue");
  });

  it("lists languages without a session", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/translate/{proxy+}",
        rawPath: "/api/translate/languages",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { languages: unknown[] };
    expect(body.languages.length).toBeGreaterThan(5);
  });
});
