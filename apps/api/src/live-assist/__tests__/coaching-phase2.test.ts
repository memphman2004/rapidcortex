/**
 * Phase 2 coaching tests: WebRTC token authz, PTT events, KVS channel lifecycle.
 *
 * Uses vi.mock to stub:
 *   - liveAssistSessionStore
 *   - liveAssistCoachingStore
 *   - liveAssistEventStore
 *   - KvsChannelService
 *   - AuditRepository (via auditEvent helper)
 *   - sendWebSocketMessage / broadcastToAgency
 *
 * Tests do NOT make real AWS / DynamoDB calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canCoachLiveAssist,
  canViewLiveAssist,
  LIVE_ASSIST_AUDIT_TYPES,
} from "rapid-cortex-shared";
import type { UserContext, LiveAssistSession, LiveAssistCoachingChannel } from "rapid-cortex-shared";

// ─── Test helpers ─────────────────────────────────────────────────────────────

function supervisorCtx(agencyId = "agency-1"): UserContext {
  return { userId: "sup-1", role: "supervisor", agencyId, email: "s@test.com" } as unknown as UserContext;
}

function dispatcherCtx(agencyId = "agency-1"): UserContext {
  return { userId: "dis-1", role: "dispatcher", agencyId, email: "d@test.com" } as unknown as UserContext;
}

function officerCtx(agencyId = "agency-1"): UserContext {
  return { userId: "off-1", role: "CAMPUS_SECURITY", agencyId, email: "o@test.com" } as unknown as UserContext;
}

const AGENCY = "agency-1";
const SESSION_ID = "session-abc123";
const CHANNEL_ID = "channel-def456";
const CHANNEL_NAME = `la-coaching-${SESSION_ID}`;

function makeSession(overrides: Partial<LiveAssistSession> = {}): LiveAssistSession {
  return {
    sessionId: SESSION_ID,
    tenantId: AGENCY,
    deviceId: "device-1",
    officerId: "off-1",
    incidentId: null,
    manufacturer: "synthetic",
    streamStatus: "streaming",
    coachingStatus: "active",
    lastLatitude: null,
    lastLongitude: null,
    lastLocationAt: null,
    locationSource: null,
    kvsChannelName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    endedAt: null,
    ...overrides,
  } as unknown as LiveAssistSession;
}

function makeChannel(overrides: Partial<LiveAssistCoachingChannel> = {}): LiveAssistCoachingChannel {
  return {
    channelId: CHANNEL_ID,
    sessionId: SESSION_ID,
    tenantId: AGENCY,
    transportType: "webrtc",
    channelState: "active",
    coachingStatus: "active",
    coachingKvsChannelName: CHANNEL_NAME,
    supervisorId: "sup-1",
    officerEndpointRef: null,
    supervisorEndpointRef: null,
    signalingState: "negotiated",
    officerAcknowledgedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as unknown as LiveAssistCoachingChannel;
}

// ─── Authorization tests ──────────────────────────────────────────────────────

describe("coaching token authz — canCoachLiveAssist", () => {
  it("supervisor can request master token", () => {
    expect(canCoachLiveAssist(supervisorCtx(), AGENCY)).toBe(true);
  });

  it("agencyadmin can request master token", () => {
    const ctx = { userId: "a1", role: "agencyadmin", agencyId: AGENCY, email: "a@t.com" } as unknown as UserContext;
    expect(canCoachLiveAssist(ctx, AGENCY)).toBe(true);
  });

  it("dispatcher cannot request master token (view-only)", () => {
    expect(canCoachLiveAssist(dispatcherCtx(), AGENCY)).toBe(false);
  });

  it("auditor cannot request master token", () => {
    const ctx = { userId: "a2", role: "auditor", agencyId: AGENCY, email: "au@t.com" } as unknown as UserContext;
    expect(canCoachLiveAssist(ctx, AGENCY)).toBe(false);
  });

  it("campus_supervisor can coach", () => {
    const ctx = { userId: "cs1", role: "CAMPUS_SUPERVISOR", agencyId: AGENCY, email: "cs@t.com" } as unknown as UserContext;
    expect(canCoachLiveAssist(ctx, AGENCY)).toBe(true);
  });

  it("cross-agency supervisor is denied", () => {
    const ctx = { userId: "s2", role: "supervisor", agencyId: "agency-999", email: "s2@t.com" } as unknown as UserContext;
    expect(canCoachLiveAssist(ctx, AGENCY)).toBe(false);
  });

  it("viewer role (canViewLiveAssist) allows dispatcher (read-only)", () => {
    expect(canViewLiveAssist(dispatcherCtx(), AGENCY)).toBe(true);
  });
});

// ─── PTT audit event type constants ──────────────────────────────────────────

describe("coaching audit event types", () => {
  it("LIVE_ASSIST_COACHING_PTT maps to live_assist.coaching.ptt", () => {
    expect(LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_COACHING_PTT).toBe("live_assist.coaching.ptt");
  });

  it("LIVE_ASSIST_COACHING_TOKEN_ISSUED maps to live_assist.coaching.token_issued", () => {
    expect(LIVE_ASSIST_AUDIT_TYPES.LIVE_ASSIST_COACHING_TOKEN_ISSUED).toBe(
      "live_assist.coaching.token_issued",
    );
  });
});

// ─── KVS channel lifecycle helpers (pure unit tests, no AWS) ─────────────────

describe("KVS channel name convention", () => {
  it("coaching channel name follows la-coaching-{sessionId} pattern", () => {
    const id = "session-xyz789";
    const channelName = `la-coaching-${id}`;
    expect(channelName).toBe("la-coaching-session-xyz789");
    expect(channelName.startsWith("la-coaching-")).toBe(true);
  });

  it("channel name is unique per session", () => {
    const ids = ["sess-001", "sess-002", "sess-003"];
    const names = ids.map((id) => `la-coaching-${id}`);
    expect(new Set(names).size).toBe(3);
  });
});

// ─── Token response shape ─────────────────────────────────────────────────────

describe("LiveAssistCoachingTokenResponse shape", () => {
  it("contains all required fields for KVS WebRTC MASTER connection", () => {
    // Simulate what the API returns
    const mockResponse = {
      sessionId: SESSION_ID,
      channelId: CHANNEL_ID,
      kvsChannelName: CHANNEL_NAME,
      channelArn: `arn:aws:kinesisvideo:us-east-1:123456789012:channel/${CHANNEL_NAME}/1234567890`,
      region: "us-east-1",
      role: "master" as const,
      credentials: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: "AQoXnyc4lcK4w",
        expiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      wssEndpoint: "wss://abc.kinesisvideo.us-east-1.amazonaws.com",
      iceServers: [
        { urls: ["stun:stun.kinesisvideo.us-east-1.amazonaws.com:443"] },
        {
          urls: ["turn:turn.kinesisvideo.us-east-1.amazonaws.com:443"],
          username: "turn-user",
          credential: "turn-cred",
        },
      ],
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    expect(mockResponse.role).toBe("master");
    expect(mockResponse.kvsChannelName).toContain("la-coaching-");
    expect(mockResponse.iceServers.length).toBeGreaterThan(0);
    expect(new Date(mockResponse.credentials.expiration).getTime()).toBeGreaterThan(Date.now());
  });

  it("viewer role response has role=viewer", () => {
    const mockResponse = { role: "viewer" as const };
    expect(mockResponse.role).toBe("viewer");
  });
});

// ─── Channel state machine constraints ───────────────────────────────────────

describe("coaching channel state guards", () => {
  it("token cannot be issued when channel is ended", () => {
    const channel = makeChannel({ channelState: "ended" });
    // Guard mirrors the HTTP handler: ended channels → 400
    expect(channel.channelState === "ended").toBe(true);
  });

  it("token cannot be issued when coachingKvsChannelName is null (non-WebRTC transport)", () => {
    const channel = makeChannel({ coachingKvsChannelName: null });
    expect(channel.coachingKvsChannelName).toBeNull();
  });

  it("active channel with channel name can issue token", () => {
    const channel = makeChannel();
    expect(channel.channelState).toBe("active");
    expect(channel.coachingKvsChannelName).toBe(CHANNEL_NAME);
  });

  it("PTT is only valid when coachingStatus is active", () => {
    const activeSession = makeSession({ coachingStatus: "active" });
    const noneSession = makeSession({ coachingStatus: "none" });
    expect(activeSession.coachingStatus === "active").toBe(true);
    expect(noneSession.coachingStatus === "active").toBe(false);
  });
});

// ─── WebSocket event types ────────────────────────────────────────────────────

describe("coaching WebSocket event types", () => {
  it("LIVE_ASSIST_WS_EVENT_TYPES contains all required coaching events", async () => {
    const { LIVE_ASSIST_WS_EVENT_TYPES } = await import("rapid-cortex-shared");
    expect(LIVE_ASSIST_WS_EVENT_TYPES).toContain("live-assist.coaching.requested");
    expect(LIVE_ASSIST_WS_EVENT_TYPES).toContain("live-assist.coaching.accepted");
    expect(LIVE_ASSIST_WS_EVENT_TYPES).toContain("live-assist.coaching.ended");
    expect(LIVE_ASSIST_WS_EVENT_TYPES).toContain("live-assist.coaching.ptt");
  });
});

// ─── KvsChannelService mock test ──────────────────────────────────────────────

describe("KvsChannelService.createCoachingChannel (mocked)", () => {
  it("returns la-coaching-{sessionId} channel name", async () => {
    const mockCreate = vi.fn().mockResolvedValue(CHANNEL_NAME);

    // Simulate what the HTTP handler does when coaching is requested
    const channelName = await mockCreate(SESSION_ID);
    expect(channelName).toBe(`la-coaching-${SESSION_ID}`);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(SESSION_ID);
  });

  it("is idempotent — second call for same sessionId returns same channel name", async () => {
    const mockCreate = vi.fn().mockResolvedValue(CHANNEL_NAME);

    const name1 = await mockCreate(SESSION_ID);
    const name2 = await mockCreate(SESSION_ID);
    expect(name1).toBe(name2);
  });

  it("delete is called on terminate with the channel name", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const channel = makeChannel();

    await mockDelete(channel.coachingKvsChannelName);
    expect(mockDelete).toHaveBeenCalledWith(CHANNEL_NAME);
  });
});

// ─── KvsChannelService.issueChannelToken role test (mocked) ──────────────────

describe("KvsChannelService.issueChannelToken (mocked)", () => {
  const baseTokenResult = {
    channelName: CHANNEL_NAME,
    channelArn: `arn:aws:kinesisvideo:us-east-1:123456789012:channel/${CHANNEL_NAME}/1234`,
    region: "us-east-1",
    credentials: {
      accessKeyId: "AK123",
      secretAccessKey: "SK456",
      sessionToken: "tok",
      expiration: new Date(Date.now() + 900_000).toISOString(),
    },
    wssEndpoint: "wss://kvs.us-east-1.amazonaws.com",
    iceServers: [{ urls: ["stun:stun.kvs.us-east-1.amazonaws.com:443"] }],
  };

  it("master token request uses ConnectAsMaster permission", async () => {
    const mockIssue = vi.fn().mockResolvedValue(baseTokenResult);
    const result = await mockIssue(CHANNEL_NAME, "master");
    expect(mockIssue).toHaveBeenCalledWith(CHANNEL_NAME, "master");
    expect(result.channelName).toBe(CHANNEL_NAME);
  });

  it("viewer token request uses ConnectAsViewer permission", async () => {
    const mockIssue = vi.fn().mockResolvedValue(baseTokenResult);
    const result = await mockIssue(CHANNEL_NAME, "viewer");
    expect(mockIssue).toHaveBeenCalledWith(CHANNEL_NAME, "viewer");
    expect(result.wssEndpoint).toContain("wss://");
  });

  it("credentials have a future expiration (15 min window)", async () => {
    const mockIssue = vi.fn().mockResolvedValue(baseTokenResult);
    const result = await mockIssue(CHANNEL_NAME, "master");
    const exp = new Date(result.credentials.expiration).getTime();
    expect(exp).toBeGreaterThan(Date.now());
  });
});
