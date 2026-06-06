import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDdbSend, mockIssueViewerToken, mockAuditCreate } = vi.hoisted(() => ({
  mockDdbSend: vi.fn(),
  mockIssueViewerToken: vi.fn(),
  mockAuditCreate: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {},
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: mockDdbSend }),
  },
  GetCommand: class GetCommand {
    constructor(public readonly input: unknown) {}
  },
  UpdateCommand: class UpdateCommand {
    constructor(public readonly input: unknown) {}
  },
}));

vi.mock("../../../shared/kvs-channel-service.js", () => ({
  KvsChannelService: class {
    issueViewerToken = mockIssueViewerToken;
  },
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

import { handler } from "../../../shared/handlers/stream-viewer-token.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../../../handlers/handlerTestUtils.js";

const viewerTokenFixture = {
  channelName: "rc-venue-sess-1",
  channelArn: "arn:aws:kinesisvideo:us-east-1:123:channel/rc-venue-sess-1",
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
    sessionToken: "token",
    expiration: new Date(Date.now() + 3_600_000).toISOString(),
  },
  wssEndpoint: "wss://signaling.example.com",
  iceServers: [{ urls: ["stun:stun.example.com:443"] }],
};

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    agencyId: "agency-a",
    status: "ACTIVE",
    kvsChannelName: "rc-venue-sess-1",
    incidentId: "inc-1",
    ...overrides,
  };
}

describe("postStreamViewerToken handler", () => {
  beforeEach(() => {
    vi.stubEnv("VENUE_CAMERA_SESSIONS_TABLE", "venue-sessions");
    vi.stubEnv("CONNECT_SESSIONS_TABLE", "connect-sessions");
    mockDdbSend.mockReset();
    mockIssueViewerToken.mockReset();
    mockAuditCreate.mockReset();
    mockIssueViewerToken.mockResolvedValue(viewerTokenFixture);
    mockAuditCreate.mockResolvedValue(undefined);
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return { Item: activeSession() };
      }
      return {};
    });
  });

  it("returns 403 when user lacks workspace.live_video", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "analyst",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockIssueViewerToken).not.toHaveBeenCalled();
  });

  it("returns 403 when session agencyId does not match user agencyId", async () => {
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return { Item: activeSession({ agencyId: "agency-other" }) };
      }
      return {};
    });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockIssueViewerToken).not.toHaveBeenCalled();
  });

  it("returns 409 when session status is closed", async () => {
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return { Item: activeSession({ status: "CLOSED" }) };
      }
      return {};
    });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(mockIssueViewerToken).not.toHaveBeenCalled();
  });

  it("returns 409 when session is not ACTIVE", async () => {
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return {
          Item: activeSession({
            status: "ENDED",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
          }),
        };
      }
      return {};
    });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 when sessionId is not found in the sessions table", async () => {
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return {};
      }
      return {};
    });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "missing", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when product is not connect or venue", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "invalid" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(mockDdbSend).not.toHaveBeenCalled();
  });

  it("returns 200 with channelArn, wssEndpoint, iceServers on valid venue session", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-1", product: "venue" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as {
      channelArn: string;
      wssEndpoint: string;
      iceServers: unknown[];
      sessionId: string;
    };
    expect(body.channelArn).toBe(viewerTokenFixture.channelArn);
    expect(body.wssEndpoint).toBe(viewerTokenFixture.wssEndpoint);
    expect(body.iceServers).toEqual(viewerTokenFixture.iceServers);
    expect(body.sessionId).toBe("sess-1");
    expect(mockIssueViewerToken).toHaveBeenCalledWith("rc-venue-sess-1");
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  it("returns 200 with channelArn, wssEndpoint, iceServers on valid connect session", async () => {
    mockDdbSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return {
          Item: activeSession({
            kvsChannelName: "rc-connect-sess-2",
          }),
        };
      }
      return {};
    });
    mockIssueViewerToken.mockResolvedValue({
      ...viewerTokenFixture,
      channelName: "rc-connect-sess-2",
      channelArn: "arn:aws:kinesisvideo:us-east-1:123:channel/rc-connect-sess-2",
    });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        body: JSON.stringify({ sessionId: "sess-2", product: "connect" }),
        rawPath: "/api/stream/viewer-token",
        routeKey: "POST /api/stream/viewer-token",
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as {
      channelArn: string;
      wssEndpoint: string;
      iceServers: unknown[];
    };
    expect(body.channelArn).toContain("rc-connect-sess-2");
    expect(body.wssEndpoint).toBeTruthy();
    expect(body.iceServers.length).toBeGreaterThan(0);
    expect(mockIssueViewerToken).toHaveBeenCalledWith("rc-connect-sess-2");
  });
});
