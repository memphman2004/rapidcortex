import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getIncidentMock,
  createSessionMock,
  getBySessionIdMock,
  getByCallerTokenHashMock,
  getByIncidentIdMock,
  mergeSessionMock,
  updateHeartbeatMock,
  markActiveMock,
  auditCreateMock,
  sendSmsMock,
  getPlaybackInfoMock,
} = vi.hoisted(() => ({
  getIncidentMock: vi.fn(),
  createSessionMock: vi.fn(),
  getBySessionIdMock: vi.fn(),
  getByCallerTokenHashMock: vi.fn(),
  getByIncidentIdMock: vi.fn(),
  mergeSessionMock: vi.fn(),
  updateHeartbeatMock: vi.fn(),
  markActiveMock: vi.fn(),
  auditCreateMock: vi.fn(),
  sendSmsMock: vi.fn(),
  getPlaybackInfoMock: vi.fn(),
}));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    get = getIncidentMock;
  },
}));

vi.mock("../repositories/liveVideoRepository.js", () => ({
  LiveVideoRepository: class {
    createSession = createSessionMock;
    getBySessionId = getBySessionIdMock;
    getByCallerTokenHash = getByCallerTokenHashMock;
    getByIncidentId = getByIncidentIdMock;
    mergeSession = mergeSessionMock;
    updateHeartbeat = updateHeartbeatMock;
    markActive = markActiveMock;
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreateMock;
  },
}));

vi.mock("./sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: sendSmsMock,
}));

vi.mock("./kvsStorageService.js", () => ({
  createStorageStreamForSession: vi.fn(),
  deleteVideoStream: vi.fn(),
  enableStorageForChannel: vi.fn(),
  getPlaybackInfo: (...a: unknown[]) => getPlaybackInfoMock(...a),
}));

import { env } from "../lib/env.js";
import { LiveVideoService } from "./liveVideoService.js";

describe("LiveVideoService", () => {
  beforeEach(() => {
    process.env.ENABLE_LIVE_VIDEO = "true";
    process.env.LIVE_VIDEO_SESSIONS_TABLE = "live-video-table";
    process.env.LIVE_VIDEO_PUBLIC_BASE_URL = "https://rapidcortex.us";
    process.env.AWS_REGION = "us-east-1";
    getIncidentMock.mockReset();
    createSessionMock.mockReset();
    getBySessionIdMock.mockReset();
    getByCallerTokenHashMock.mockReset();
    updateHeartbeatMock.mockReset();
    markActiveMock.mockReset();
    auditCreateMock.mockReset();
    sendSmsMock.mockReset();
  });

  it("creates a session and sends SMS", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "twilio",
      status: "sent",
      messageId: "SM123",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: false,
    });

    const svc = new LiveVideoService();
    const out = await svc.requestLiveVideo(
      "inc-1",
      { userId: "u-1", role: "dispatcher", agencyId: "agency-a", email: "d@agency.example" } as never,
      { callerPhone: "+15555550100" },
    );

    expect(sendSmsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ messageType: "live_video" }),
    );
    expect(out.status).toBe("pending");
    expect(out.provider).toBe("twilio");
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock).toHaveBeenCalled();
  });

  it("passes aws SMS mode into the factory when env selects aws", async () => {
    const prev = env.smsProvider;
    env.smsProvider = "aws";
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "msg-sns-1",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: false,
    });
    try {
      const svc = new LiveVideoService();
      const out = await svc.requestLiveVideo(
        "inc-1",
        { userId: "u-1", role: "dispatcher", agencyId: "agency-a", email: "d@agency.example" } as never,
        { callerPhone: "+15555550100" },
      );
      expect(sendSmsMock.mock.calls[0]![0].smsProvider).toBe("aws");
      expect(out.provider).toBe("aws");
    } finally {
      env.smsProvider = prev;
    }
  });

  it("joins by token and marks active after consent", async () => {
    getByCallerTokenHashMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      requestedBy: "u-1",
      callerPhone: "+15555550100",
      callerTokenHash: "x".repeat(64),
      dispatcherJoinAllowed: true,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      callerIceCandidates: [],
      dispatcherIceCandidates: [],
    });
    updateHeartbeatMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      requestedBy: "u-1",
      callerPhone: "+15555550100",
      callerTokenHash: "x".repeat(64),
      dispatcherJoinAllowed: true,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      callerIceCandidates: [],
      dispatcherIceCandidates: [],
    });
    markActiveMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      requestedBy: "u-1",
      callerPhone: "+15555550100",
      callerTokenHash: "x".repeat(64),
      dispatcherJoinAllowed: true,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      callerIceCandidates: [],
      dispatcherIceCandidates: [],
    });
    getBySessionIdMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      requestedBy: "u-1",
      callerPhone: "+15555550100",
      callerTokenHash: "x".repeat(64),
      dispatcherJoinAllowed: true,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      callerIceCandidates: [],
      dispatcherIceCandidates: [],
    });

    const svc = new LiveVideoService();
    const out = await svc.joinLiveSession("caller-token", { consentAccepted: true });
    expect(out.status).toBe("active");
    expect(markActiveMock).toHaveBeenCalledTimes(1);
  });

  it("getRecordedPlayback returns HLS info and records audit", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    getByIncidentIdMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      storageMode: "kvs-ingestion",
      kvsVideoStreamName: "rc-lvsv-lvs-1",
      kvsVideoStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/foo/1",
    });
    mergeSessionMock.mockImplementation(async (p: { sessionId: string }) => ({
      sessionId: p.sessionId,
      incidentId: "inc-1",
      agencyId: "agency-a",
      playbackReadyAt: new Date().toISOString(),
    }));
    getPlaybackInfoMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      status: "ready",
      storageMode: "kvs-ingestion",
      hlsPlaybackUrl: "https://example.invalid/hls.m3u8",
      hlsUrlExpiresAt: new Date().toISOString(),
    });
    const svc = new LiveVideoService();
    const out = await svc.getRecordedPlayback("inc-1", {
      userId: "u-1",
      role: "dispatcher",
      agencyId: "agency-a",
    } as never);
    expect(out.status).toBe("ready");
    expect(getPlaybackInfoMock).toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "live_video.playback_accessed" as const }),
    );
  });
});
