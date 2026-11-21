/**
 * BodyCameraProvider — manufacturer-agnostic interface for body-worn camera integration.
 *
 * Extends the existing CameraProvider pattern (rapid-vision) with BWC-specific operations:
 *   - Device enrollment and capability declaration
 *   - GPS telemetry subscription
 *   - Coaching channel signaling (audio separate from video)
 *   - Stream lifecycle with reconnection support
 *
 * Rules:
 *   - Only implement operations ACTUALLY supported by the vendor.
 *   - Return BodyCameraUnsupportedResult for unimplemented capabilities — never throw.
 *   - PENDING_VENDOR_AUTHORIZATION connectors return integrationStatus "vendor_authorization_required".
 *   - Never invent proprietary API endpoints or bypass vendor auth.
 */

import type {
  BodyCameraCapabilityManifest,
  BodyCameraManufacturer,
  BodyCameraIntegrationStatus,
  LiveAssistLocation,
} from "rapid-cortex-shared";

// ─── Result wrapper ───────────────────────────────────────────────────────────

export interface BodyCameraUnsupportedResult {
  supported: false;
  code:
    | "UNSUPPORTED_CAPABILITY"
    | "VENDOR_AUTHORIZATION_REQUIRED"
    | "CREDENTIALS_REQUIRED"
    | "DEVICE_OFFLINE"
    | "PROVIDER_ERROR";
  manufacturer: BodyCameraManufacturer;
  capability: string;
  message: string;
}

export type BodyCameraResult<T> =
  | ({ supported: true } & T)
  | BodyCameraUnsupportedResult;

// ─── Provider identity ────────────────────────────────────────────────────────

export interface BodyCameraProviderIdentity {
  manufacturer: BodyCameraManufacturer;
  displayName: string;
  integrationStatus: BodyCameraIntegrationStatus;
  defaultCapabilities: Partial<BodyCameraCapabilityManifest>;
  documentationUrl: string | null;
  /** Set to true when this connector is PENDING_VENDOR_AUTHORIZATION */
  pendingVendorAuthorization: boolean;
}

// ─── Device list ──────────────────────────────────────────────────────────────

export interface BodyCameraDeviceInfo {
  providerDeviceId: string;
  model: string | null;
  hardwareId: string | null;
  firmwareVersion: string | null;
  batteryPercent: number | null;
  isOnline: boolean;
  isRecording: boolean;
  isStreaming: boolean;
  capabilities: Partial<BodyCameraCapabilityManifest>;
}

// ─── Stream ───────────────────────────────────────────────────────────────────

export interface BodyCameraStreamParams {
  tenantId: string;
  agencyId: string;
  sessionId: string;
  deviceId: string;
  providerDeviceId: string;
  officerId: string | null;
  /** KVS channel name to push the inbound stream into, when bridging via gateway */
  targetKvsChannelName: string | null;
}

export interface BodyCameraStreamResult {
  providerSessionId: string;
  /** KVS channel name the stream is available on (may be null for direct WebRTC) */
  kvsChannelName: string | null;
  /** KVS stream ARN, when using HLS path */
  kvsStreamArn: string | null;
  /** Stream access token for the viewer-side, if the vendor issues one */
  viewerToken: string | null;
  /** Ingest URL when provider needs to push RTSP/HLS to our gateway */
  ingestUrl: string | null;
  expiresAt: string;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export interface BodyCameraLocationResult {
  location: LiveAssistLocation;
}

// ─── Coaching signaling ───────────────────────────────────────────────────────

export interface CoachingInviteParams {
  sessionId: string;
  officerEndpointRef: string;
  supervisorDisplayName: string;
  /** Pre-shared WebRTC SDP offer from the supervisor, if transport is webrtc */
  sdpOffer: string | null;
}

export interface CoachingInviteResult {
  channelId: string;
  /** SDP answer from the officer's device, if WebRTC */
  sdpAnswer: string | null;
  /** True if the officer's device immediately acknowledged (native app push) */
  immediateAck: boolean;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface BodyCameraProviderHealthResult {
  status: "online" | "degraded" | "offline" | "unknown";
  lastChecked: string;
  detail: string | null;
}

// ─── Main interface ───────────────────────────────────────────────────────────

export interface BodyCameraProvider {
  readonly identity: BodyCameraProviderIdentity;

  /** Test vendor API connectivity and credential validity */
  validateConnection(agencyId: string): Promise<BodyCameraProviderHealthResult>;

  /** List devices registered to this agency through the vendor */
  listDevices(agencyId: string): Promise<BodyCameraResult<{ devices: BodyCameraDeviceInfo[] }>>;

  /** Get current status of a specific device */
  getDeviceStatus(
    agencyId: string,
    providerDeviceId: string,
  ): Promise<BodyCameraResult<{ device: BodyCameraDeviceInfo }>>;

  /** Request a live stream from the device (or verify an in-progress stream) */
  requestStream(params: BodyCameraStreamParams): Promise<BodyCameraResult<BodyCameraStreamResult>>;

  /** Get the latest GPS location for a device */
  getLocation(
    agencyId: string,
    providerDeviceId: string,
  ): Promise<BodyCameraResult<BodyCameraLocationResult>>;

  /** Send a coaching channel invite to the officer's registered endpoint */
  inviteToCoaching(params: CoachingInviteParams): Promise<BodyCameraResult<CoachingInviteResult>>;

  /** Terminate a live stream (if the vendor supports remote termination) */
  terminateStream(
    agencyId: string,
    providerDeviceId: string,
    providerSessionId: string,
  ): Promise<BodyCameraResult<{ terminated: boolean }>>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

export function bwcUnsupported(
  manufacturer: BodyCameraManufacturer,
  capability: string,
  message: string,
  code: BodyCameraUnsupportedResult["code"] = "UNSUPPORTED_CAPABILITY",
): BodyCameraUnsupportedResult {
  return { supported: false, code, manufacturer, capability, message };
}
