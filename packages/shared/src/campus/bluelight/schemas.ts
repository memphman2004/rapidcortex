/**
 * Campus Blue-Light Connect — Shared Zod schemas and TypeScript types.
 * Campus vertical only. Do not import from venue, transit, PSAP, or hospital trees.
 */

import { z } from "zod";

// ─── Pole Registry ────────────────────────────────────────────────────────────

export const poleVendorSchema = z.enum([
  "code_blue",
  "talkaphone",
  "rath",
  "gai_tronics",
  "alertus",
  "aiphone",
  "unknown",
]);
export type PoleVendor = z.infer<typeof poleVendorSchema>;

export const streamPreferenceSchema = z.enum(["webrtc", "hls", "vms"]);
export type StreamPreference = z.infer<typeof streamPreferenceSchema>;

export const poleStatusSchema = z.enum(["active", "offline", "maintenance"]);
export type PoleStatus = z.infer<typeof poleStatusSchema>;

export const blueLightGeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type BlueLightGeoPoint = z.infer<typeof blueLightGeoPointSchema>;

export const linkedCameraSchema = z.object({
  cameraId: z.string().min(1),
  label: z.string().min(1),
  streamPreference: streamPreferenceSchema,
  /** KVS channel name, RTSP URL, or VMS camera ID depending on streamPreference */
  streamRef: z.string().min(1),
  distanceMeters: z.number().nonnegative(),
});
export type LinkedCamera = z.infer<typeof linkedCameraSchema>;

export const blueLightPoleSchema = z.object({
  poleId: z.string().min(1),
  campusId: z.string().min(1),
  label: z.string().min(1),
  zone: z.string().min(1),
  buildingId: z.string().optional(),
  location: blueLightGeoPointSchema,
  linkedCameras: z.array(linkedCameraSchema),
  vendor: poleVendorSchema,
  sipExtension: z.string().optional(),
  webhookSourceIp: z.string().optional(),
  status: poleStatusSchema,
  installedAt: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BlueLightPole = z.infer<typeof blueLightPoleSchema>;

// ─── Activation Event Payloads ────────────────────────────────────────────────

/** Format A — webhook from vendor (Code Blue, Talk-A-Phone, Alertus) */
export const webhookActivationPayloadSchema = z.object({
  event: z.literal("button_press"),
  poleId: z.string().min(1),
  timestamp: z.string(),
  vendorPayload: z.record(z.unknown()).optional(),
});
export type WebhookActivationPayload = z.infer<typeof webhookActivationPayloadSchema>;

/** Format B — SIP event from campus PBX or Amazon Connect */
export const sipActivationPayloadSchema = z.object({
  event: z.literal("sip_call"),
  sipExtension: z.string().min(1),
  callId: z.string().min(1),
  timestamp: z.string(),
});
export type SipActivationPayload = z.infer<typeof sipActivationPayloadSchema>;

/** Format C — simulation for dev/demo only (blocked in production) */
export const simulatedActivationPayloadSchema = z.object({
  event: z.literal("simulated"),
  poleId: z.string().min(1),
  timestamp: z.string(),
  simulatedCallId: z.string().optional(),
});
export type SimulatedActivationPayload = z.infer<typeof simulatedActivationPayloadSchema>;

export const rawActivationPayloadSchema = z.discriminatedUnion("event", [
  webhookActivationPayloadSchema,
  sipActivationPayloadSchema,
  simulatedActivationPayloadSchema,
]);
export type RawActivationPayload = z.infer<typeof rawActivationPayloadSchema>;

// ─── Normalized Internal Event ────────────────────────────────────────────────

export const activationEventTypeSchema = z.enum(["button_press", "sip_call", "simulated"]);
export type ActivationEventType = z.infer<typeof activationEventTypeSchema>;

export const normalizedActivationEventSchema = z.object({
  eventId: z.string(),
  eventType: activationEventTypeSchema,
  poleId: z.string(),
  campusId: z.string(),
  callId: z.string().nullable(),
  rawPayload: rawActivationPayloadSchema,
  receivedAt: z.string(),
});
export type NormalizedActivationEvent = z.infer<typeof normalizedActivationEventSchema>;

// ─── Incidents ────────────────────────────────────────────────────────────────

export const blueLightIncidentStatusSchema = z.enum([
  "active",
  "monitoring",
  "resolved",
  "false_alarm",
]);
export type BlueLightIncidentStatus = z.infer<typeof blueLightIncidentStatusSchema>;

export const callStatusSchema = z.enum(["active", "ended", "transferred", "none"]);
export type CallStatus = z.infer<typeof callStatusSchema>;

export const incidentLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  zone: z.string(),
  buildingId: z.string().nullable(),
  display: z.string(),
});
export type BlueLightIncidentLocation = z.infer<typeof incidentLocationSchema>;

export const transcriptChunkSchema = z.object({
  chunkId: z.string(),
  speakerRole: z.enum(["caller", "dispatcher"]),
  text: z.string(),
  timestamp: z.string(),
  confidence: z.number().min(0).max(1),
});
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;

export const blueLightIncidentSchema = z.object({
  incidentId: z.string(),
  type: z.literal("blue_light_activation"),
  priority: z.literal("high"),
  source: z.literal("blue_light_connect"),
  campusId: z.string(),
  poleId: z.string(),
  poleLabel: z.string(),
  location: incidentLocationSchema,
  linkedCameras: z.array(linkedCameraSchema),
  callId: z.string().nullable(),
  callStatus: callStatusSchema,
  status: blueLightIncidentStatusSchema,
  transcript: z.array(transcriptChunkSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type BlueLightIncident = z.infer<typeof blueLightIncidentSchema>;

// ─── WebSocket Push Messages ───────────────────────────────────────────────────

export const BLUE_LIGHT_WS_EVENT_ACTIVATION = "BLUE_LIGHT_ACTIVATION";
export const BLUE_LIGHT_WS_EVENT_INCIDENT_UPDATE = "BLUE_LIGHT_INCIDENT_UPDATE";
export const BLUE_LIGHT_WS_EVENT_TRANSCRIPT = "BLUE_LIGHT_TRANSCRIPT";

export const blueLightActivationMessageSchema = z.object({
  messageType: z.literal(BLUE_LIGHT_WS_EVENT_ACTIVATION),
  incident: blueLightIncidentSchema,
});
export type BlueLightActivationMessage = z.infer<typeof blueLightActivationMessageSchema>;

export const blueLightIncidentUpdateMessageSchema = z.object({
  messageType: z.literal(BLUE_LIGHT_WS_EVENT_INCIDENT_UPDATE),
  incidentId: z.string(),
  updates: blueLightIncidentSchema.partial(),
});
export type BlueLightIncidentUpdateMessage = z.infer<typeof blueLightIncidentUpdateMessageSchema>;

export const blueLightTranscriptMessageSchema = z.object({
  messageType: z.literal(BLUE_LIGHT_WS_EVENT_TRANSCRIPT),
  incidentId: z.string(),
  chunk: transcriptChunkSchema,
});
export type BlueLightTranscriptMessage = z.infer<typeof blueLightTranscriptMessageSchema>;

export type BlueLightWsMessage =
  | BlueLightActivationMessage
  | BlueLightIncidentUpdateMessage
  | BlueLightTranscriptMessage;

// ─── API Request/Response ──────────────────────────────────────────────────────

export const activateResponseSchema = z.object({
  success: z.literal(true),
  eventId: z.string(),
  incidentId: z.string(),
  poleId: z.string(),
  message: z.string(),
});
export type ActivateResponse = z.infer<typeof activateResponseSchema>;

export const getPolesResponseSchema = z.object({
  poles: z.array(blueLightPoleSchema),
  campusId: z.string(),
  total: z.number(),
});
export type GetPolesResponse = z.infer<typeof getPolesResponseSchema>;
