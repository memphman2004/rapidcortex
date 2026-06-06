import { createHash, randomBytes } from "node:crypto";
import { AUDIT_EVENT_TYPES, AuthorizationService, TenantAccessGuard } from "rapid-cortex-security";
import type {
  EndLiveVideoPayload,
  GetLiveSessionResponse,
  JoinLiveVideoPayload,
  JoinLiveVideoResponse,
  KvsBrowserBundle,
  LiveHeartbeatPayload,
  LiveVideoSession,
  RecordedPlaybackResponse,
  RequestLiveVideoPayload,
  UserContext,
} from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { LiveVideoRepository } from "../repositories/liveVideoRepository.js";
import {
  buildKvsBrowserBundle,
  createKinesisSignalingChannel,
  deleteKinesisSignalingChannel,
  isKvsPipelineConfigured,
} from "./kvsWebRtcService.js";
import {
  createStorageStreamForSession,
  deleteVideoStream,
  enableStorageForChannel,
  getPlaybackInfo,
} from "./kvsStorageService.js";
import { sendIncidentMediaLinkSms } from "./sms/smsProviderFactory.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();
const repo = new LiveVideoRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function assertConfigured(): void {
  if (!env.enableLiveVideo) throw new Error("LIVE_VIDEO_DISABLED");
  if (!env.liveVideoSessionsTable) throw new Error("LIVE_VIDEO_SESSIONS_TABLE_NOT_CONFIGURED");
}

function assertDispatcherRole(user: UserContext): void {
  if (!authz.canDispatch(user) || user.role === "auditor") {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (
    user.role !== "dispatcher" &&
    user.role !== "supervisor" &&
    user.role !== "agencyadmin" &&
    user.role !== "rcsuperadmin"
  ) {
    const err = new Error("FORBIDDEN_ROLE");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function assertSessionOpen(session: LiveVideoSession): void {
  if (Date.parse(session.expiresAt) < Date.now()) throw new Error("SESSION_EXPIRED");
  if (session.status === "ended" || session.status === "expired" || session.status === "failed") {
    throw new Error("SESSION_CLOSED");
  }
}

function toJoinResponse(
  session: LiveVideoSession,
  role: "caller" | "dispatcher",
  iceServers: { urls: string | string[]; username?: string; credential?: string }[],
  kvs?: KvsBrowserBundle,
): JoinLiveVideoResponse {
  return {
    sessionId: session.sessionId,
    status: session.status,
    expiresAt: session.expiresAt,
    role,
    liveVideoPipeline: session.liveVideoPipeline,
    answerSdp: session.answerSdp,
    offerSdp: session.offerSdp,
    callerIceCandidates: session.callerIceCandidates ?? [],
    dispatcherIceCandidates: session.dispatcherIceCandidates ?? [],
    ...(kvs ? { kvs } : {}),
    iceServers,
    heartbeatIntervalSeconds: 10,
  };
}

function isKvsSession(s: LiveVideoSession): boolean {
  return Boolean(s.signalingChannelArn && s.kinesisViewerClientId);
}

function readIceServers(): { urls: string | string[]; username?: string; credential?: string }[] {
  const raw = process.env.WEBRTC_ICE_SERVERS_JSON?.trim() ?? process.env.VIDEO_ASSIST_ICE_SERVERS_JSON?.trim() ?? "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { urls: string | string[]; username?: string; credential?: string }[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through
    }
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
}

async function cleanupKinesisLiveVideoResources(session: {
  signalingChannelArn?: string | null;
  kvsVideoStreamArn?: string | null;
}): Promise<void> {
  await deleteKinesisSignalingChannel(session.signalingChannelArn);
  await deleteVideoStream(session.kvsVideoStreamArn);
}

export class LiveVideoService {
  async requestLiveVideo(incidentId: string, user: UserContext, body: RequestLiveVideoPayload) {
    assertConfigured();
    assertDispatcherRole(user);
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);

    const sessionId = makeId("lvs");
    const callerToken = newOpaqueToken();
    const callerTokenHash = hashToken(callerToken);
    const createdAt = nowIso();
    const ttlSeconds = body.ttlSeconds ?? env.liveVideoSessionTtlSeconds;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const ttlEpoch = Math.floor(Date.parse(expiresAt) / 1000);
    const base = body.publicAppBaseUrl?.replace(/\/$/, "") || env.liveVideoPublicBaseUrl?.replace(/\/$/, "") || "";
    if (!base) throw new Error("MISSING_PUBLIC_BASE_URL");
    const callerUrl = `${base}/media/live/${encodeURIComponent(callerToken)}`;

    const smsText = `Rapid Cortex: A dispatcher requested a secure live video link for your active incident. Joining is optional. Open: ${callerUrl}`;
    const smsResult = await sendIncidentMediaLinkSms(
      {
        smsProvider: env.smsProvider,
        smsPrimaryProvider: env.smsPrimaryProvider,
        deploymentStage: env.deploymentStage,
        incidentMediaSmsMock: env.incidentMediaSmsMock,
        mockSmsProvider: env.mockSmsProvider,
        awsRegion: env.region,
        awsSmsRegion: env.awsSmsRegion,
        awsSmsUseSimulator: env.awsSmsUseSimulator,
        twilioSecretArn: env.incidentMediaTwilioSecretArn,
        awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
        awsSmsPoolId: env.awsSmsPoolId,
      },
      {
        toPhoneE164: body.callerPhone,
        messageBody: smsText,
        agencyId: incident.agencyId,
        incidentId,
        messageType: "live_video",
      },
    );

    const storageMode = body.storageMode ?? env.liveVideoStorageMode;
    const smsOk = smsResult.status === "sent";
    let signalingChannelArn: string | undefined;
    let signalingChannelName: string | undefined;
    let kinesisViewerClientId: string | undefined;
    let liveVideoPipeline: "aws_kinesis_webrtc" | "legacy_p2p" = "legacy_p2p";
    let kvsError = false;
    if (smsOk && isKvsPipelineConfigured()) {
      kinesisViewerClientId = makeId("kvc");
      try {
        const ch = await createKinesisSignalingChannel(sessionId);
        signalingChannelArn = ch.channelArn;
        signalingChannelName = ch.channelName;
        liveVideoPipeline = "aws_kinesis_webrtc";
      } catch {
        kvsError = true;
      }
    }

    let kvsVideoStreamArn: string | undefined;
    let kvsVideoStreamName: string | undefined;
    let storageConfiguredAt: string | undefined;
    let channelMediaStorageAttached: boolean | undefined;
    if (
      smsOk &&
      !kvsError &&
      liveVideoPipeline === "aws_kinesis_webrtc" &&
      signalingChannelArn &&
      storageMode === "kvs-ingestion"
    ) {
      try {
        const st = await createStorageStreamForSession(sessionId);
        kvsVideoStreamArn = st.streamArn;
        kvsVideoStreamName = st.streamName;
        storageConfiguredAt = nowIso();
        if (env.liveVideoKvsStorageAttachToChannel) {
          await enableStorageForChannel(signalingChannelArn, st.streamArn);
          channelMediaStorageAttached = true;
        }
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: incident.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.LIVE_VIDEO_STORAGE_CONFIGURED,
          details: {
            sessionId,
            streamArn: st.streamArn,
            channelAttached: Boolean(channelMediaStorageAttached),
          },
          createdAt: nowIso(),
          resourceType: "incident",
          resourceId: incidentId,
        });
      } catch {
        // Live session can continue without cloud storage if stream creation fails.
      }
    }

    const session: LiveVideoSession = {
      sessionId,
      incidentId,
      agencyId: incident.agencyId,
      requestedBy: user.userId,
      callerPhone: body.callerPhone,
      callerTokenHash,
      dispatcherJoinAllowed: true,
      status: !smsOk ? "failed" : kvsError ? "failed" : "pending",
      createdAt,
      expiresAt,
      provider: smsResult.provider,
      smsDeliveryProvider: smsResult.provider,
      turnConfigRef: env.webrtcTurnSecretArn || undefined,
      auditVersion: 1,
      smsSentAt: smsOk ? createdAt : undefined,
      smsStatus: smsResult.status,
      smsFailoverUsed: smsResult.smsFailoverUsed === true,
      smsErrorCode: smsOk ? undefined : smsResult.errorCode,
      smsMessageId: smsResult.messageId,
      ttlEpoch,
      callerIceCandidates: [],
      dispatcherIceCandidates: [],
      liveVideoPipeline,
      signalingChannelArn,
      signalingChannelName,
      kinesisViewerClientId,
      kvsChannelRoleMode: "caller-master-dispatcher-viewer",
      storageMode,
      kvsVideoStreamArn,
      kvsVideoStreamName,
      storageConfiguredAt,
      channelMediaStorageAttached,
    };
    await repo.createSession(session);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.LIVE_VIDEO_REQUESTED,
      details: { sessionId, smsProvider: smsResult.provider, recipientRedacted: smsResult.recipientRedacted },
      createdAt,
      resourceType: "incident",
      resourceId: incidentId,
    });

    if (smsResult.status === "sent") {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_SMS_SENT,
        details: {
          sessionId,
          messageId: smsResult.messageId,
          provider: smsResult.provider,
          smsFailoverUsed: smsResult.smsFailoverUsed === true,
        },
        createdAt,
        resourceType: "incident",
        resourceId: incidentId,
      });
    } else {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_SMS_FAILED,
        details: {
          sessionId,
          errorCode: smsResult.errorCode,
          lastProvider: smsResult.provider,
          smsFailoverUsed: smsResult.smsFailoverUsed === true,
          firstAttemptErrorCode: smsResult.firstAttemptErrorCode,
          recipientRedacted: smsResult.recipientRedacted,
        },
        createdAt,
        resourceType: "incident",
        resourceId: incidentId,
      });
    }

    return {
      sessionId,
      status: session.status,
      expiresAt,
      maskedRecipient: redactE164Phone(body.callerPhone),
      provider: smsResult.provider,
      liveVideoPipeline: session.liveVideoPipeline,
      storageMode: session.storageMode,
    };
  }

  async getLiveSession(incidentId: string, user: UserContext): Promise<GetLiveSessionResponse> {
    assertConfigured();
    assertDispatcherRole(user);
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const session = await repo.getByIncidentId(incident.agencyId, incidentId);
    if (!session) throw new Error("NOT_FOUND");
    if (Date.parse(session.expiresAt) < Date.now() && session.status !== "ended") {
      await cleanupKinesisLiveVideoResources(session);
      await repo.endSession({
        sessionId: session.sessionId,
        endedAt: nowIso(),
        endedBy: "system",
        endReason: "timeout",
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        incidentId,
        actorId: "system",
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_EXPIRED,
        details: { sessionId: session.sessionId, reason: "session_ttl" },
        createdAt: nowIso(),
        resourceType: "incident",
        resourceId: incidentId,
      });
      throw new Error("SESSION_EXPIRED");
    }
    const base = {
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      activatedAt: session.activatedAt,
      endedAt: session.endedAt,
      callerHeartbeatAt: session.lastCallerHeartbeatAt,
      dispatcherHeartbeatAt: session.lastDispatcherHeartbeatAt,
      offerSdp: session.offerSdp,
      answerSdp: session.answerSdp,
      callerIceCandidates: session.callerIceCandidates ?? [],
      dispatcherIceCandidates: session.dispatcherIceCandidates ?? [],
      liveVideoPipeline: session.liveVideoPipeline,
      storageMode: session.storageMode,
      kvsChannelRoleMode: session.kvsChannelRoleMode,
      channelMediaStorageAttached: session.channelMediaStorageAttached,
      kvsVideoStreamArn: session.kvsVideoStreamArn,
      kvsVideoStreamName: session.kvsVideoStreamName,
      storageConfiguredAt: session.storageConfiguredAt,
      playbackReadyAt: session.playbackReadyAt,
      iceServers: readIceServers(),
    } satisfies GetLiveSessionResponse;
    if (!isKvsSession(session) || (session.status !== "pending" && session.status !== "active")) {
      return base;
    }
    const kvs = await buildKvsBrowserBundle({
      channelArn: session.signalingChannelArn!,
      sessionId: session.sessionId,
      role: "VIEWER",
      viewerClientId: session.kinesisViewerClientId!,
    });
    if (!session.kvsDispatcherJoinAudited) {
      await repo.mergeSession({ sessionId: session.sessionId, kvsDispatcherJoinAudited: true });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_DISPATCHER_JOINED,
        details: { sessionId: session.sessionId, pipeline: "aws_kinesis_webrtc" },
        createdAt: nowIso(),
        resourceType: "incident",
        resourceId: incidentId,
      });
    }
    return { ...base, kvs };
  }

  async joinLiveSession(token: string, payload: JoinLiveVideoPayload): Promise<JoinLiveVideoResponse> {
    assertConfigured();
    const session = await repo.getByCallerTokenHash(hashToken(decodeURIComponent(token)));
    if (!session) throw new Error("NOT_FOUND");
    assertSessionOpen(session);
    await repo.updateHeartbeat({
      sessionId: session.sessionId,
      role: "caller",
      heartbeatAt: nowIso(),
      offerSdp: payload.offerSdp,
      iceCandidate: payload.iceCandidate,
    });
    if (payload.consentAccepted && session.status === "pending") {
      await repo.markActive(session.sessionId, nowIso());
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: session.agencyId,
        incidentId: session.incidentId,
        actorId: "caller:join",
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_CALLER_JOINED,
        details: { sessionId: session.sessionId },
        createdAt: nowIso(),
        resourceType: "incident",
        resourceId: session.incidentId,
      });
      if (isKvsSession(session)) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: session.agencyId,
          incidentId: session.incidentId,
          actorId: "caller:join",
          type: AUDIT_EVENT_TYPES.LIVE_VIDEO_ACTIVATED,
          details: { sessionId: session.sessionId, pipeline: "aws_kinesis_webrtc" },
          createdAt: nowIso(),
          resourceType: "incident",
          resourceId: session.incidentId,
        });
      }
    }
    const latest = (await repo.getBySessionId(session.sessionId)) ?? session;
    let kvs: KvsBrowserBundle | undefined;
    if (payload.consentAccepted && isKvsSession(session)) {
      kvs = await buildKvsBrowserBundle({
        channelArn: session.signalingChannelArn!,
        sessionId: session.sessionId,
        role: "MASTER",
      });
    }
    return toJoinResponse(latest, "caller", readIceServers(), kvs);
  }

  async liveHeartbeatFromCaller(token: string, payload: LiveHeartbeatPayload): Promise<JoinLiveVideoResponse> {
    assertConfigured();
    const session = await repo.getByCallerTokenHash(hashToken(decodeURIComponent(token)));
    if (!session) throw new Error("NOT_FOUND");
    assertSessionOpen(session);
    if (payload.markEnded) {
      const ended = await repo.endSession({
        sessionId: session.sessionId,
        endedAt: nowIso(),
        endedBy: "caller",
        endReason: "manual",
      });
      await cleanupKinesisLiveVideoResources(ended);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: ended.agencyId,
        incidentId: ended.incidentId,
        actorId: "caller:end",
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_ENDED,
        details: { sessionId: ended.sessionId, by: "caller", reason: "manual" },
        createdAt: ended.endedAt ?? nowIso(),
        resourceType: "incident",
        resourceId: ended.incidentId,
      });
      return toJoinResponse(ended, "caller", readIceServers());
    }
    const updated = await repo.updateHeartbeat({
      sessionId: session.sessionId,
      role: "caller",
      heartbeatAt: nowIso(),
      offerSdp: payload.offerSdp,
      iceCandidate: payload.iceCandidate,
    });
    return toJoinResponse(updated, "caller", readIceServers());
  }

  async liveHeartbeatFromDispatcher(
    incidentId: string,
    user: UserContext,
    payload: LiveHeartbeatPayload,
  ): Promise<JoinLiveVideoResponse> {
    assertConfigured();
    assertDispatcherRole(user);
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const session = payload.sessionId
      ? await repo.getBySessionId(payload.sessionId)
      : await repo.getByIncidentId(incident.agencyId, incidentId);
    if (!session || session.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertSessionOpen(session);

    if (payload.markEnded) {
      const ended = await repo.endSession({
        sessionId: session.sessionId,
        endedAt: nowIso(),
        endedBy: "dispatcher",
        endReason: "manual",
      });
      await cleanupKinesisLiveVideoResources(ended);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: ended.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_ENDED,
        details: { sessionId: ended.sessionId, by: "dispatcher", reason: "manual" },
        createdAt: ended.endedAt ?? nowIso(),
        resourceType: "incident",
        resourceId: incidentId,
      });
      return toJoinResponse(ended, "dispatcher", readIceServers());
    }

    let updated = await repo.updateHeartbeat({
      sessionId: session.sessionId,
      role: "dispatcher",
      heartbeatAt: nowIso(),
      answerSdp: payload.answerSdp,
      iceCandidate: payload.iceCandidate,
    });
    if (!isKvsSession(session) && updated.status === "pending" && updated.answerSdp) {
      updated = await repo.markActive(updated.sessionId, nowIso());
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: updated.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_DISPATCHER_JOINED,
        details: { sessionId: updated.sessionId },
        createdAt: nowIso(),
        resourceType: "incident",
        resourceId: incidentId,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: updated.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LIVE_VIDEO_ACTIVATED,
        details: { sessionId: updated.sessionId },
        createdAt: nowIso(),
        resourceType: "incident",
        resourceId: incidentId,
      });
    }
    return toJoinResponse(updated, "dispatcher", readIceServers());
  }

  async endLiveSession(incidentId: string, user: UserContext, payload: EndLiveVideoPayload) {
    return this.liveHeartbeatFromDispatcher(incidentId, user, {
      role: "dispatcher",
      sessionId: payload.sessionId,
      markEnded: true,
    });
  }

  /** Authenticated join — same join bundle as GET /live-video (explicit route for clients). */
  async joinIncidentLiveVideo(incidentId: string, user: UserContext): Promise<GetLiveSessionResponse> {
    return this.getLiveSession(incidentId, user);
  }

  async getRecordedPlayback(incidentId: string, user: UserContext): Promise<RecordedPlaybackResponse> {
    assertConfigured();
    assertDispatcherRole(user);
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const session = await repo.getByIncidentId(incident.agencyId, incidentId);
    if (!session) throw new Error("NOT_FOUND");
    const out = await getPlaybackInfo({
      sessionId: session.sessionId,
      incidentId,
      storageMode: session.storageMode ?? "off",
      streamName: session.kvsVideoStreamName,
      streamArn: session.kvsVideoStreamArn,
    });
    if (out.status === "ready" && !session.playbackReadyAt) {
      await repo.mergeSession({ sessionId: session.sessionId, playbackReadyAt: nowIso() });
    }
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: session.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.LIVE_VIDEO_PLAYBACK_ACCESSED,
      details: { sessionId: session.sessionId, playbackStatus: out.status },
      createdAt: nowIso(),
      resourceType: "incident",
      resourceId: incidentId,
    });
    return out;
  }
}
