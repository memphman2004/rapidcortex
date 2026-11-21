/**
 * NexCort iQ — Live Assist
 * Manufacturer-agnostic body-worn camera monitoring and real-time officer coaching.
 *
 * Live Assist is a human-supervised decision-support capability.
 * It must not make autonomous law enforcement decisions or replace CAD, radio, or telephony.
 */

// ─── Manufacturer / Provider ──────────────────────────────────────────────────

export type BodyCameraManufacturer =
  | "getac"       // Getac BC-04 / Getac Video Solutions — PENDING_VENDOR_AUTHORIZATION
  | "axon"        // Axon Body cameras / Axon Respond — PENDING_VENDOR_AUTHORIZATION
  | "motorola"    // Motorola Solutions V700 / CommandCentral — PENDING_VENDOR_AUTHORIZATION
  | "axis"        // Axis body-worn cameras — documented integration path
  | "zepcam"      // ZEPCAM — documented generic API + RTSP path
  | "rtsp"        // Generic authorized RTSP-compatible
  | "webrtc"      // Generic authorized WebRTC-compatible
  | "synthetic";  // Synthetic/demo — clearly labeled, never shown as a real officer

export type BodyCameraIntegrationStatus =
  | "available_for_configuration"
  | "vendor_authorization_required"
  | "credentials_required"
  | "connected"
  | "limited_capabilities"
  | "disconnected"
  | "unsupported"
  | "error";

// ─── Device Capability Model ──────────────────────────────────────────────────

export interface BodyCameraCapabilityManifest {
  /** Manufacturer / provider ID */
  manufacturer: BodyCameraManufacturer;
  /** Whether the device can transmit a live video feed */
  liveVideoSupported: boolean;
  /** Whether the device exposes incident audio to authorized viewers */
  liveAudioSupported: boolean;
  /** Whether the device provides GPS coordinates */
  gpsSupported: boolean;
  /** Whether a supervisor can remotely activate the stream (vs. officer initiates) */
  remoteStreamActivationSupported: boolean;
  /** Media protocols the device can use: "kvs-webrtc" | "rtsp" | "hls" | "webrtc-vendor" */
  supportedMediaProtocols: string[];
  /** How the stream authenticates: "oauth" | "api-key" | "vendor-sdk" | "open" */
  streamAuthMechanism: string;
  /** Whether active agency licensing from the manufacturer is required */
  manufacturerLicensingRequired: boolean;
  /** Maximum number of concurrent authorized viewers (0 = unlimited / unknown) */
  maxConcurrentViewers: number;
  /** Audio codecs: e.g. ["OPUS", "G.711"] */
  audioCodecs: string[];
  /** Video codecs: e.g. ["H.264", "H.265", "VP8"] */
  videoCodecs: string[];
  /** Firmware-level connectivity status granularity */
  connectivityStatusGranular: boolean;
  /** Whether the device exposes its recording state via API */
  recordingStatusExposed: boolean;
  /** Whether the manufacturer has authorized third-party live integration */
  thirdPartyIntegrationAuthorized: boolean;
}

// ─── Live Assist Provider (tenant-scoped manufacturer config) ─────────────────

export type LiveAssistProviderStatus = BodyCameraIntegrationStatus;

export interface LiveAssistProvider {
  tenantId: string;
  providerId: string;
  manufacturer: BodyCameraManufacturer;
  /** References Secrets Manager ARN — never stored inline */
  credentialsSecretArn: string | null;
  integrationStatus: LiveAssistProviderStatus;
  /** Verified capabilities from the last successful handshake */
  verifiedCapabilities: Partial<BodyCameraCapabilityManifest> | null;
  /** Additional manufacturer-specific configuration (non-secret) */
  configJson: Record<string, unknown>;
  lastValidatedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Live Assist Device ───────────────────────────────────────────────────────

export type BodyCameraConnectivityState =
  | "online"
  | "offline"
  | "recording"
  | "streaming"
  | "low_battery"
  | "unknown";

export interface LiveAssistDevice {
  tenantId: string;
  deviceId: string;
  providerId: string;
  manufacturer: BodyCameraManufacturer;
  /** Manufacturer-assigned device identifier */
  providerDeviceId: string;
  /** Serial number or hardware ID, when available */
  hardwareId: string | null;
  model: string | null;
  /** Officer this device is currently assigned to */
  assignedOfficerId: string | null;
  /** CAD unit / radio identifier */
  agencyUnitId: string | null;
  /** Capabilities verified on this specific unit (overrides provider defaults) */
  capabilityManifest: Partial<BodyCameraCapabilityManifest>;
  connectivityState: BodyCameraConnectivityState;
  batteryPercent: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Live Assist Session ──────────────────────────────────────────────────────

export type LiveAssistStreamStatus =
  | "not_started"
  | "requesting"
  | "active"
  | "degraded"
  | "interrupted"
  | "ended";

export type LiveAssistCoachingStatus =
  | "none"
  | "requested"
  | "officer_notified"
  | "active"
  | "muted"
  | "ended";

export interface LiveAssistSession {
  tenantId: string;
  sessionId: string;
  /** Associated incident from NexCort iQ or CAD. Optional — session can exist without incident. */
  incidentId: string | null;
  deviceId: string;
  officerId: string | null;
  /** Supervisor who initiated the session. Can transfer to another supervisor. */
  supervisorId: string;
  manufacturer: BodyCameraManufacturer;
  streamStatus: LiveAssistStreamStatus;
  coachingStatus: LiveAssistCoachingStatus;
  /** KVS channel name for the inbound body-camera video stream */
  kvsChannelName: string | null;
  /** KVS stream ARN, when using HLS path */
  kvsStreamArn: string | null;
  /** Measured end-to-end video delay in milliseconds, updated by media gateway */
  measuredVideoDelayMs: number | null;
  /** True when the supervisor has been notified that video is significantly delayed */
  videoDelayAlertSent: boolean;
  startedAt: string;
  endedAt: string | null;
  /** ISO string — stream access token expires; renew before this time */
  streamTokenExpiresAt: string | null;
  /** Last GPS position received */
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationAt: string | null;
  locationSource: "device_gps" | "mobile_gps" | "avl" | null;
}

// ─── Coaching Channel ─────────────────────────────────────────────────────────

export type CoachingTransportType =
  | "webrtc"       // Browser/app WebRTC audio
  | "sip"          // SIP gateway integration (future)
  | "radio_gw"     // Agency-approved radio gateway (future, requires separate vendor approval)
  | "mobile_app";  // Native mobile coaching app

export type CoachingChannelState =
  | "pending"
  | "officer_notified"
  | "officer_accepted"
  | "active"
  | "supervisor_muted"
  | "officer_muted"
  | "interrupted"
  | "ended";

export interface LiveAssistCoachingChannel {
  tenantId: string;
  channelId: string;
  sessionId: string;
  /** Officer's registered coaching endpoint (device token, SIP URI, etc.) */
  officerEndpointRef: string | null;
  /** Supervisor's WebRTC peer connection identifier */
  supervisorEndpointRef: string | null;
  transportType: CoachingTransportType;
  /** WebRTC SDP offer/answer exchange state */
  signalingState: "idle" | "offer_sent" | "answer_received" | "connected" | null;
  channelState: CoachingChannelState;
  /** True if officer acknowledged and joined the coaching session */
  officerAcknowledgedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** ID of supervisor who currently holds the coaching floor */
  activeFloorSupervisorId: string | null;
  /** Supervisors who may request the floor */
  authorizedSupervisorIds: string[];
  /**
   * KVS SINGLE_MASTER signaling channel name for WebRTC audio coaching.
   * Named: `la-coaching-{sessionId}`
   * Supervisor connects as MASTER; officer connects as VIEWER.
   * Null when transport is not webrtc, or not yet provisioned.
   */
  coachingKvsChannelName: string | null;
}

// ─── Live Assist Event (Continuity Log) ──────────────────────────────────────

export type LiveAssistEventType =
  | "SESSION_CREATED"
  | "DEVICE_ASSOCIATED"
  | "INCIDENT_ASSOCIATED"
  | "STREAM_REQUESTED"
  | "STREAM_STARTED"
  | "STREAM_DEGRADED"
  | "STREAM_INTERRUPTED"
  | "STREAM_RECONNECTED"
  | "STREAM_ENDED"
  | "VIEWER_JOINED"
  | "VIEWER_LEFT"
  | "LOCATION_UPDATED"
  | "COACHING_REQUESTED"
  | "COACHING_OFFICER_NOTIFIED"
  | "COACHING_ACCEPTED"
  | "COACHING_STARTED"
  | "COACHING_SUPERVISOR_MUTED"
  | "COACHING_SUPERVISOR_UNMUTED"
  | "COACHING_OFFICER_MUTED"
  | "COACHING_OFFICER_UNMUTED"
  | "COACHING_FLOOR_TRANSFERRED"
  | "COACHING_ENDED"
  | "SESSION_ENDED"
  | "NOTE_ADDED";

export interface LiveAssistEvent {
  tenantId: string;
  sessionId: string;
  eventId: string;
  eventType: LiveAssistEventType;
  actorId: string;
  timestamp: string;
  /** Freeform metadata (non-sensitive operational context) */
  metadata: Record<string, unknown>;
}

// ─── GPS Location ─────────────────────────────────────────────────────────────

export interface LiveAssistLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  headingDeg: number | null;
  source: "device_gps" | "mobile_gps" | "avl";
  timestamp: string;
}

// ─── Audit Actions ────────────────────────────────────────────────────────────

export type LiveAssistAuditAction =
  | "LIVE_ASSIST_SESSION_CREATED"
  | "LIVE_ASSIST_STREAM_STARTED"
  | "LIVE_ASSIST_STREAM_ENDED"
  | "LIVE_ASSIST_COACHING_STARTED"
  | "LIVE_ASSIST_COACHING_ENDED"
  | "LIVE_ASSIST_COACHING_PTT"
  | "LIVE_ASSIST_COACHING_TOKEN_ISSUED"
  | "LIVE_ASSIST_DEVICE_REGISTERED"
  | "LIVE_ASSIST_PROVIDER_CONFIGURED"
  | "LIVE_ASSIST_VIEWER_JOINED";

// ─── RBAC permission strings ──────────────────────────────────────────────────

export const LIVE_ASSIST_PERMISSIONS = {
  view:              "liveAssist.view",
  listen:            "liveAssist.listen",
  coach:             "liveAssist.coach",
  manageSessions:    "liveAssist.manageSessions",
  manageProviders:   "liveAssist.manageProviders",
  manageDevices:     "liveAssist.manageDevices",
  configureRetention:"liveAssist.configureRetention",
  viewAudit:         "liveAssist.viewAudit",
} as const;

export type LiveAssistPermission = (typeof LIVE_ASSIST_PERMISSIONS)[keyof typeof LIVE_ASSIST_PERMISSIONS];
