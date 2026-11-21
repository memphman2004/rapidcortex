import { z } from "zod";
import type {
  BodyCameraManufacturer,
  CoachingTransportType,
  LiveAssistAuditAction,
} from "./types.js";

// ─── Manufacturer enum ────────────────────────────────────────────────────────

export const bodyCameraManufacturerSchema = z.enum([
  "getac",
  "axon",
  "motorola",
  "axis",
  "zepcam",
  "rtsp",
  "webrtc",
  "synthetic",
] satisfies [BodyCameraManufacturer, ...BodyCameraManufacturer[]]);

// ─── Provider registration / update ──────────────────────────────────────────

export const liveAssistProviderCreateSchema = z.object({
  manufacturer: bodyCameraManufacturerSchema,
  credentialsSecretArn: z.string().max(2048).nullable().optional(),
  configJson: z.record(z.unknown()).optional(),
}).strict();

export const liveAssistProviderUpdateSchema = z.object({
  credentialsSecretArn: z.string().max(2048).nullable().optional(),
  configJson: z.record(z.unknown()).optional(),
}).strict();

// ─── Device registration / update ────────────────────────────────────────────

export const liveAssistDeviceCreateSchema = z.object({
  providerId: z.string().min(1).max(128),
  providerDeviceId: z.string().min(1).max(256),
  hardwareId: z.string().max(256).nullable().optional(),
  model: z.string().max(128).nullable().optional(),
  assignedOfficerId: z.string().max(128).nullable().optional(),
  agencyUnitId: z.string().max(128).nullable().optional(),
}).strict();

export const liveAssistDeviceUpdateSchema = z.object({
  assignedOfficerId: z.string().max(128).nullable().optional(),
  agencyUnitId: z.string().max(128).nullable().optional(),
  model: z.string().max(128).nullable().optional(),
}).strict();

// ─── Session creation ─────────────────────────────────────────────────────────

export const liveAssistSessionCreateSchema = z.object({
  deviceId: z.string().min(1).max(128),
  incidentId: z.string().min(1).max(128).nullable().optional(),
  officerId: z.string().min(1).max(128).nullable().optional(),
}).strict();

// ─── Stream request ───────────────────────────────────────────────────────────

export const liveAssistStreamRequestSchema = z.object({
  /** Client-side hint on max acceptable video delay; informational only */
  maxDelayMs: z.number().int().min(500).max(30000).optional(),
}).strict();

// ─── Coaching control ─────────────────────────────────────────────────────────

export const liveAssistCoachingRequestSchema = z.object({
  transportType: z.enum(["webrtc", "sip", "radio_gw", "mobile_app"] satisfies [CoachingTransportType, ...CoachingTransportType[]])
    .default("webrtc"),
  officerEndpointRef: z.string().max(512).nullable().optional(),
}).strict();

export const liveAssistCoachingAcceptSchema = z.object({
  officerEndpointRef: z.string().max(512).nullable().optional(),
}).strict();

// ─── Location update (from authorized mobile client) ─────────────────────────

export const liveAssistLocationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  source: z.enum(["device_gps", "mobile_gps", "avl"]),
}).strict();

// ─── Event query ──────────────────────────────────────────────────────────────

export const liveAssistEventQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  since: z.string().datetime().optional(),
}).strict();

// ─── Note ─────────────────────────────────────────────────────────────────────

export const liveAssistNoteSchema = z.object({
  note: z.string().min(1).max(2000),
}).strict();

// ─── Coaching WebRTC token query ──────────────────────────────────────────────

export const liveAssistCoachingTokenQuerySchema = z.object({
  /** Supervisors request "master" credentials; officers request "viewer" credentials */
  role: z.enum(["master", "viewer"]).default("master"),
}).strict();

export type LiveAssistCoachingTokenQuery = z.infer<typeof liveAssistCoachingTokenQuerySchema>;

// ─── Push-to-Talk event ───────────────────────────────────────────────────────

export const liveAssistPttSchema = z.object({
  /** true = supervisor is now speaking; false = stopped speaking */
  active: z.boolean(),
}).strict();

export type LiveAssistPtt = z.infer<typeof liveAssistPttSchema>;

// ─── Coaching WebRTC token response ──────────────────────────────────────────

/**
 * Returned by GET /api/live-assist/sessions/{id}/coaching/token
 * Client uses these credentials to connect to the KVS signaling channel
 * via the KVS WebRTC SDK.
 */
export interface LiveAssistCoachingTokenResponse {
  sessionId: string;
  channelId: string;
  kvsChannelName: string;
  channelArn: string;
  region: string;
  role: "master" | "viewer";
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };
  wssEndpoint: string;
  iceServers: Array<{ urls: string[]; username?: string; credential?: string }>;
  expiresAt: string;
}

// ─── WebSocket event types for coaching ──────────────────────────────────────

export const LIVE_ASSIST_WS_EVENT_TYPES = [
  "live-assist.coaching.requested",
  "live-assist.coaching.accepted",
  "live-assist.coaching.ended",
  "live-assist.coaching.ptt",
  "live-assist.session.ended",
] as const;
export type LiveAssistWsEventType = (typeof LIVE_ASSIST_WS_EVENT_TYPES)[number];

// ─── Audit event ─────────────────────────────────────────────────────────────

export const LIVE_ASSIST_AUDIT_TYPES: Record<LiveAssistAuditAction, string> = {
  LIVE_ASSIST_SESSION_CREATED:        "live_assist.session.created",
  LIVE_ASSIST_STREAM_STARTED:         "live_assist.stream.started",
  LIVE_ASSIST_STREAM_ENDED:           "live_assist.stream.ended",
  LIVE_ASSIST_COACHING_STARTED:       "live_assist.coaching.started",
  LIVE_ASSIST_COACHING_ENDED:         "live_assist.coaching.ended",
  LIVE_ASSIST_COACHING_PTT:           "live_assist.coaching.ptt",
  LIVE_ASSIST_COACHING_TOKEN_ISSUED:  "live_assist.coaching.token_issued",
  LIVE_ASSIST_DEVICE_REGISTERED:      "live_assist.device.registered",
  LIVE_ASSIST_PROVIDER_CONFIGURED:    "live_assist.provider.configured",
  LIVE_ASSIST_VIEWER_JOINED:          "live_assist.viewer.joined",
};

// ─── Inferred types ───────────────────────────────────────────────────────────

export type LiveAssistProviderCreate = z.infer<typeof liveAssistProviderCreateSchema>;
export type LiveAssistProviderUpdate = z.infer<typeof liveAssistProviderUpdateSchema>;
export type LiveAssistDeviceCreate   = z.infer<typeof liveAssistDeviceCreateSchema>;
export type LiveAssistDeviceUpdate   = z.infer<typeof liveAssistDeviceUpdateSchema>;
export type LiveAssistSessionCreate   = z.infer<typeof liveAssistSessionCreateSchema>;
export type LiveAssistStreamRequest   = z.infer<typeof liveAssistStreamRequestSchema>;
export type LiveAssistCoachingRequest = z.infer<typeof liveAssistCoachingRequestSchema>;
export type LiveAssistCoachingAccept  = z.infer<typeof liveAssistCoachingAcceptSchema>;
export type LiveAssistLocationUpdate  = z.infer<typeof liveAssistLocationUpdateSchema>;
export type LiveAssistEventQuery      = z.infer<typeof liveAssistEventQuerySchema>;
export type LiveAssistNote            = z.infer<typeof liveAssistNoteSchema>;
