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
  endSessionMock,
  auditCreateMock,
  sendSmsMock,
  getPlaybackInfoMock,
  deleteVideoStreamMock,
  enableStorageForChannelMock,
  enqueueRecordingExportMock,
  exportSessionClipToS3Mock,
  presignRecordingDownloadMock,
  createStorageStreamForSessionMock,
  createKinesisSignalingChannelMock,
  deleteKinesisSignalingChannelMock,
  isKvsPipelineConfiguredMock,
} = vi.hoisted(() => ({
  getIncidentMock: vi.fn(),
  createSessionMock: vi.fn(),
  getBySessionIdMock: vi.fn(),
  getByCallerTokenHashMock: vi.fn(),
  getByIncidentIdMock: vi.fn(),
  mergeSessionMock: vi.fn(),
  updateHeartbeatMock: vi.fn(),
  markActiveMock: vi.fn(),
  endSessionMock: vi.fn(),
  auditCreateMock: vi.fn(),
  sendSmsMock: vi.fn(),
  getPlaybackInfoMock: vi.fn(),
  deleteVideoStreamMock: vi.fn(),
  enableStorageForChannelMock: vi.fn(),
  enqueueRecordingExportMock: vi.fn(),
  exportSessionClipToS3Mock: vi.fn(),
  presignRecordingDownloadMock: vi.fn(),
  createStorageStreamForSessionMock: vi.fn(),
  createKinesisSignalingChannelMock: vi.fn(),
  deleteKinesisSignalingChannelMock: vi.fn(),
  isKvsPipelineConfiguredMock: vi.fn(),
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
    endSession = endSessionMock;
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
  createStorageStreamForSession: (...a: unknown[]) => createStorageStreamForSessionMock(...a),
  deleteVideoStream: (...a: unknown[]) => deleteVideoStreamMock(...a),
  enableStorageForChannel: (...a: unknown[]) => enableStorageForChannelMock(...a),
  getPlaybackInfo: (...a: unknown[]) => getPlaybackInfoMock(...a),
  enqueueRecordingExport: (...a: unknown[]) => enqueueRecordingExportMock(...a),
  exportSessionClipToS3: (...a: unknown[]) => exportSessionClipToS3Mock(...a),
  presignRecordingDownload: (...a: unknown[]) => presignRecordingDownloadMock(...a),
}));

vi.mock("./kvsWebRtcService.js", () => ({
  createKinesisSignalingChannel: (...a: unknown[]) => createKinesisSignalingChannelMock(...a),
  deleteKinesisSignalingChannel: (...a: unknown[]) => deleteKinesisSignalingChannelMock(...a),
  isKvsPipelineConfigured: (...a: unknown[]) => isKvsPipelineConfiguredMock(...a),
  buildKvsBrowserBundle: vi.fn(),
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
    getByIncidentIdMock.mockReset();
    mergeSessionMock.mockReset();
    endSessionMock.mockReset();
    getPlaybackInfoMock.mockReset();
    deleteVideoStreamMock.mockReset();
    enableStorageForChannelMock.mockReset();
    enqueueRecordingExportMock.mockReset();
    exportSessionClipToS3Mock.mockReset();
    presignRecordingDownloadMock.mockReset();
    createStorageStreamForSessionMock.mockReset();
    createKinesisSignalingChannelMock.mockReset();
    deleteKinesisSignalingChannelMock.mockReset();
    isKvsPipelineConfiguredMock.mockReset();
    isKvsPipelineConfiguredMock.mockReturnValue(false);
    exportSessionClipToS3Mock.mockResolvedValue({ ok: false, errorCode: "NO_FRAGMENTS" });
    presignRecordingDownloadMock.mockResolvedValue(null);
    enqueueRecordingExportMock.mockResolvedValue(undefined);
    deleteVideoStreamMock.mockResolvedValue(undefined);
    mergeSessionMock.mockImplementation(async (p: { sessionId: string } & Record<string, unknown>) => ({
      sessionId: p.sessionId,
      incidentId: "inc-1",
      agencyId: "agency-a",
      ...p,
    }));
  });

  it("rejects operators without workspace.live_video", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    const svc = new LiveVideoService();
    await expect(
      svc.requestLiveVideo(
        "inc-1",
        { userId: "u-1", role: "auditor", agencyId: "agency-a", email: "a@agency.example" } as never,
        { callerPhone: "+15555550100" },
      ),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("fails closed when KVS storage attach fails under kvs-ingestion", async () => {
    const prevMode = env.liveVideoStorageMode;
    const prevAttach = env.liveVideoKvsStorageAttachToChannel;
    env.liveVideoStorageMode = "kvs-ingestion";
    env.liveVideoKvsStorageAttachToChannel = true;
    isKvsPipelineConfiguredMock.mockReturnValue(true);
    createKinesisSignalingChannelMock.mockResolvedValue({
      channelArn: "arn:aws:kinesisvideo:us-east-1:123:channel/rc-live-x/1",
      channelName: "rc-live-x",
    });
    createStorageStreamForSessionMock.mockResolvedValue({
      streamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/rc-lvsv-x/1",
      streamName: "rc-lvsv-x",
    });
    enableStorageForChannelMock.mockRejectedValue(new Error("attach denied"));
    deleteKinesisSignalingChannelMock.mockResolvedValue(undefined);
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "aws",
      status: "sent",
      messageId: "SM123",
      recipientRedacted: "***0100",
      sentAt: new Date().toISOString(),
      retryable: false,
    });
    try {
      const svc = new LiveVideoService();
      const out = await svc.requestLiveVideo(
        "inc-1",
        { userId: "u-1", role: "dispatcher", agencyId: "agency-a", email: "d@agency.example" } as never,
        { callerPhone: "+15555550100", storageMode: "kvs-ingestion" },
      );
      expect(out.status).toBe("failed");
      expect(deleteKinesisSignalingChannelMock).toHaveBeenCalled();
      expect(createSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", liveVideoPipeline: "legacy_p2p" }),
      );
    } finally {
      env.liveVideoStorageMode = prevMode;
      env.liveVideoKvsStorageAttachToChannel = prevAttach;
    }
  });

  it("creates a session and sends SMS", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
    sendSmsMock.mockResolvedValue({
      provider: "aws",
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
    expect(out.provider).toBe("aws");
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
    expect(exportSessionClipToS3Mock).toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "live_video.playback_accessed" as const }),
    );
  });

  it("ends a session without deleting the Kinesis video stream and enqueues export", async () => {
    getIncidentMock.mockResolvedValue({ incidentId: "inc-1", agencyId: "agency-a" });
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
      storageMode: "kvs-ingestion",
      kvsVideoStreamName: "rc-lvsv-lvs-1",
      kvsVideoStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/foo/1",
    });
    endSessionMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      status: "ended",
      storageMode: "kvs-ingestion",
      kvsVideoStreamName: "rc-lvsv-lvs-1",
      kvsVideoStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/foo/1",
    });
    const svc = new LiveVideoService();
    await svc.endLiveSession(
      "inc-1",
      { userId: "u-1", role: "dispatcher", agencyId: "agency-a" } as never,
      { sessionId: "lvs-1", reason: "manual" },
    );
    expect(deleteVideoStreamMock).not.toHaveBeenCalled();
    expect(enqueueRecordingExportMock).toHaveBeenCalledWith("lvs-1");
  });

  it("deletes the video stream only after a successful GetClip export", async () => {
    getBySessionIdMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      storageMode: "kvs-ingestion",
      kvsVideoStreamName: "rc-lvsv-lvs-1",
      kvsVideoStreamArn: "arn:aws:kinesisvideo:us-east-1:123:stream/foo/1",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      endedAt: new Date().toISOString(),
    });
    exportSessionClipToS3Mock.mockResolvedValue({ ok: true, key: "live-video/agency-a/inc-1/lvs-1.mp4" });
    mergeSessionMock.mockResolvedValue({
      sessionId: "lvs-1",
      incidentId: "inc-1",
      agencyId: "agency-a",
      recordingS3Key: "live-video/agency-a/inc-1/lvs-1.mp4",
    });
    const svc = new LiveVideoService();
    const out = await svc.exportRecordingBySessionId("lvs-1");
    expect(out).toEqual({ ok: true });
    expect(deleteVideoStreamMock).toHaveBeenCalledWith("arn:aws:kinesisvideo:us-east-1:123:stream/foo/1");
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "live_video.recording.exported" as const }),
    );
  });
});
