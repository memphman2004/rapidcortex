import { z } from "zod";
import { kvsChannelRoleModeSchema, liveVideoStorageModeSchema } from "./live-session-storage.js";

export const liveVideoSessionStatusSchema = z.enum(["pending", "active", "ended", "expired", "failed"]);
export type LiveVideoSessionStatus = z.infer<typeof liveVideoSessionStatusSchema>;

export const liveVideoEndedBySchema = z.enum(["caller", "dispatcher", "system"]);
export type LiveVideoEndedBy = z.infer<typeof liveVideoEndedBySchema>;

export const liveVideoEndReasonSchema = z.enum(["manual", "timeout", "incident_closed", "disconnect", "error"]);
export type LiveVideoEndReason = z.infer<typeof liveVideoEndReasonSchema>;

export const liveVideoSessionSchema = z.object({
  sessionId: z.string().min(4).max(120),
  incidentId: z.string().min(4).max(120),
  agencyId: z.string().min(2).max(64),
  requestedBy: z.string().min(1).max(120),
  callerPhone: z.string().regex(/^\+[1-9]\d{6,22}$/),
  callerTokenHash: z.string().min(32).max(128),
  dispatcherJoinAllowed: z.boolean(),
  status: liveVideoSessionStatusSchema,
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  activatedAt: z.string().min(1).optional(),
  endedAt: z.string().min(1).optional(),
  endedBy: liveVideoEndedBySchema.optional(),
  endReason: liveVideoEndReasonSchema.optional(),
  lastCallerHeartbeatAt: z.string().min(1).optional(),
  lastDispatcherHeartbeatAt: z.string().min(1).optional(),
  /** @deprecated use smsDeliveryProvider for SMS; "provider" was historically SMS provider */
  provider: z.string().max(64).optional(),
  /** Twilio, aws, mock, etc. */
  smsDeliveryProvider: z.string().max(32).optional(),
  /** kinesis WebRTC + signaling channel, or legacy DynamoDB-sourced SDP/ICE. */
  liveVideoPipeline: z.enum(["aws_kinesis_webrtc", "legacy_p2p"]).optional(),
  signalingChannelArn: z.string().min(1).max(500).optional(),
  signalingChannelName: z.string().min(1).max(300).optional(),
  /** KVS viewer `clientId` (stable for this session; master has no client id). */
  kinesisViewerClientId: z.string().min(1).max(120).optional(),
  /** Set after first KVS viewer bundle is issued in GET live-video (one-time join audit). */
  kvsDispatcherJoinAudited: z.boolean().optional(),
  /** Product default: caller publishes (KVS master), dispatcher subscribes (viewer). */
  kvsChannelRoleMode: kvsChannelRoleModeSchema.optional(),
  /** When `kvs-ingestion`, a Kinesis **video** stream may be created for recording; see storage flags. */
  storageMode: liveVideoStorageModeSchema.optional(),
  /** True after UpdateMediaStorageConfiguration links the signaling channel to the stream (changes AWS WebRTC mode). */
  channelMediaStorageAttached: z.boolean().optional(),
  signalingChannelEndpointWss: z.string().max(600).optional(),
  signalingChannelEndpointHttps: z.string().max(600).optional(),
  kvsVideoStreamArn: z.string().max(500).optional(),
  kvsVideoStreamName: z.string().max(300).optional(),
  storageConfiguredAt: z.string().min(1).optional(),
  playbackReadyAt: z.string().min(1).optional(),
  roomId: z.string().max(120).optional(),
  turnConfigRef: z.string().max(300).optional(),
  auditVersion: z.number().int().positive().optional(),
  /** When SMS completed successfully (or simulator). */
  smsSentAt: z.string().min(1).optional(),
  /** Last outbound attempt outcome. */
  smsStatus: z.enum(["queued", "sent", "failed"]).optional(),
  /** True if `auto` mode succeeded on the second concrete provider. */
  smsFailoverUsed: z.boolean().optional(),
  /** Non-secret code when SMS did not complete (not user-facing PII). */
  smsErrorCode: z.string().max(64).optional(),
  smsMessageId: z.string().max(128).optional(),
  offerSdp: z.string().min(10).optional(),
  answerSdp: z.string().min(10).optional(),
  callerIceCandidates: z.array(z.string().min(1)).optional(),
  dispatcherIceCandidates: z.array(z.string().min(1)).optional(),
  ttlEpoch: z.number().int().positive().optional(),
});

export type LiveVideoSession = z.infer<typeof liveVideoSessionSchema>;

export const requestLiveVideoPayloadSchema = z
  .object({
    callerPhone: z.string().regex(/^\+[1-9]\d{6,22}$/),
    ttlSeconds: z.number().int().min(120).max(21_600).optional(),
    publicAppBaseUrl: z.string().url().max(500).optional(),
    /** Overrides deployment `LIVE_VIDEO_STORAGE_MODE` when set. */
    storageMode: liveVideoStorageModeSchema.optional(),
  })
  .strict();
export type RequestLiveVideoPayload = z.infer<typeof requestLiveVideoPayloadSchema>;

export const joinLiveVideoPayloadSchema = z
  .object({
    consentAccepted: z.boolean().optional(),
    offerSdp: z.string().min(10).optional(),
    answerSdp: z.string().min(10).optional(),
    iceCandidate: z.string().min(1).optional(),
  })
  .strict();
export type JoinLiveVideoPayload = z.infer<typeof joinLiveVideoPayloadSchema>;

export const kvsBrowserBundleSchema = z.object({
  channelArn: z.string(),
  region: z.string(),
  role: z.enum(["MASTER", "VIEWER"]),
  viewerClientId: z.string().min(1).max(200).optional(),
  wssUrl: z.string().min(1),
  iceServers: z.array(
    z.object({
      urls: z.union([z.string(), z.array(z.string())]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  ),
  credentials: z.object({
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    sessionToken: z.string(),
    expiration: z.string(),
  }),
});
export type KvsBrowserBundle = z.infer<typeof kvsBrowserBundleSchema>;

export const joinLiveVideoResponseSchema = z.object({
  sessionId: z.string(),
  status: liveVideoSessionStatusSchema,
  expiresAt: z.string(),
  role: z.enum(["caller", "dispatcher"]),
  answerSdp: z.string().optional(),
  offerSdp: z.string().optional(),
  callerIceCandidates: z.array(z.string()).optional(),
  dispatcherIceCandidates: z.array(z.string()).optional(),
  liveVideoPipeline: z.enum(["aws_kinesis_webrtc", "legacy_p2p"]).optional(),
  /** AWS Kinesis Video Streams WebRTC: temporary credentials and signaling endpoints. Omitted for legacy P2P. */
  kvs: kvsBrowserBundleSchema.optional(),
  iceServers: z
    .array(
      z.object({
        urls: z.union([z.string(), z.array(z.string())]),
        username: z.string().optional(),
        credential: z.string().optional(),
      }),
    )
    .optional(),
  heartbeatIntervalSeconds: z.number().int().positive().default(10),
});
export type JoinLiveVideoResponse = z.infer<typeof joinLiveVideoResponseSchema>;

/** Authenticated GET /api/incidents/:id/live-video (dispatcher / supervisor). */
export const getLiveSessionResponseSchema = z.object({
  sessionId: z.string(),
  status: liveVideoSessionStatusSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
  activatedAt: z.string().optional(),
  endedAt: z.string().optional(),
  callerHeartbeatAt: z.string().optional(),
  dispatcherHeartbeatAt: z.string().optional(),
  offerSdp: z.string().optional(),
  answerSdp: z.string().optional(),
  callerIceCandidates: z.array(z.string()).optional(),
  dispatcherIceCandidates: z.array(z.string()).optional(),
  liveVideoPipeline: z.enum(["aws_kinesis_webrtc", "legacy_p2p"]).optional(),
  storageMode: liveVideoStorageModeSchema.optional(),
  kvsChannelRoleMode: kvsChannelRoleModeSchema.optional(),
  channelMediaStorageAttached: z.boolean().optional(),
  kvsVideoStreamArn: z.string().optional(),
  kvsVideoStreamName: z.string().optional(),
  storageConfiguredAt: z.string().optional(),
  playbackReadyAt: z.string().optional(),
  kvs: kvsBrowserBundleSchema.optional(),
  iceServers: z
    .array(
      z.object({
        urls: z.union([z.string(), z.array(z.string())]),
        username: z.string().optional(),
        credential: z.string().optional(),
      }),
    )
    .optional(),
});
export type GetLiveSessionResponse = z.infer<typeof getLiveSessionResponseSchema>;

export const endLiveVideoPayloadSchema = z
  .object({
    sessionId: z.string().min(4).max(120).optional(),
    reason: liveVideoEndReasonSchema.optional(),
  })
  .strict();
export type EndLiveVideoPayload = z.infer<typeof endLiveVideoPayloadSchema>;

export const liveHeartbeatPayloadSchema = z
  .object({
    role: z.enum(["caller", "dispatcher"]),
    sessionId: z.string().min(4).max(120).optional(),
    markEnded: z.boolean().optional(),
    offerSdp: z.string().min(10).optional(),
    answerSdp: z.string().min(10).optional(),
    iceCandidate: z.string().min(1).optional(),
  })
  .strict();
export type LiveHeartbeatPayload = z.infer<typeof liveHeartbeatPayloadSchema>;
