/**
 * SyntheticBodyCameraProvider
 *
 * Fully-working synthetic adapter for demonstration and automated testing.
 * Returns clearly labeled simulated data — NEVER presented as a real officer feed.
 *
 * This adapter allows Phase 1 acceptance criteria to be met without real hardware:
 *   - Supervisor can view an authorized synthetic live camera feed
 *   - Session, coaching, and audit flows work end-to-end
 *   - Continuity Log events fire correctly
 */
import { randomUUID } from "node:crypto";
import type {
  BodyCameraProvider,
  BodyCameraProviderIdentity,
  BodyCameraStreamResult,
  BodyCameraDeviceInfo,
  BodyCameraProviderHealthResult,
  CoachingInviteResult,
} from "./BodyCameraProvider.js";
import type { BodyCameraResult } from "./BodyCameraProvider.js";
import { bwcUnsupported } from "./BodyCameraProvider.js";
import type { BodyCameraCapabilityManifest } from "rapid-cortex-shared";

const DEMO_LABEL = "[SYNTHETIC DEMO — Not a real officer. Not real data.]";

const SYNTHETIC_CAPABILITIES: Partial<BodyCameraCapabilityManifest> = {
  manufacturer: "synthetic",
  liveVideoSupported: true,
  liveAudioSupported: true,
  gpsSupported: true,
  remoteStreamActivationSupported: true,
  supportedMediaProtocols: ["kvs-webrtc"],
  streamAuthMechanism: "oauth",
  manufacturerLicensingRequired: false,
  maxConcurrentViewers: 10,
  audioCodecs: ["OPUS"],
  videoCodecs: ["H.264"],
  connectivityStatusGranular: true,
  recordingStatusExposed: true,
  thirdPartyIntegrationAuthorized: true,
};

const SYNTHETIC_DEVICES: BodyCameraDeviceInfo[] = [
  {
    providerDeviceId: "synth-bwc-001",
    model: "Synthetic BWC Pro (Demo)",
    hardwareId: "SYNTH-001",
    firmwareVersion: "1.0.0-demo",
    batteryPercent: 87,
    isOnline: true,
    isRecording: false,
    isStreaming: false,
    capabilities: SYNTHETIC_CAPABILITIES,
  },
  {
    providerDeviceId: "synth-bwc-002",
    model: "Synthetic BWC Field Unit (Demo)",
    hardwareId: "SYNTH-002",
    firmwareVersion: "1.0.0-demo",
    batteryPercent: 54,
    isOnline: true,
    isRecording: true,
    isStreaming: false,
    capabilities: SYNTHETIC_CAPABILITIES,
  },
  {
    providerDeviceId: "synth-bwc-003",
    model: "Synthetic BWC (Offline Demo)",
    hardwareId: "SYNTH-003",
    firmwareVersion: "1.0.0-demo",
    batteryPercent: 12,
    isOnline: false,
    isRecording: false,
    isStreaming: false,
    capabilities: SYNTHETIC_CAPABILITIES,
  },
];

export class SyntheticBodyCameraProvider implements BodyCameraProvider {
  readonly identity: BodyCameraProviderIdentity = {
    manufacturer: "synthetic",
    displayName: "⚠ SYNTHETIC DEMO — Not a real officer",
    integrationStatus: "connected",
    defaultCapabilities: SYNTHETIC_CAPABILITIES,
    documentationUrl: null,
    pendingVendorAuthorization: false,
  };

  async validateConnection(_agencyId: string): Promise<BodyCameraProviderHealthResult> {
    return {
      status: "online",
      lastChecked: new Date().toISOString(),
      detail: DEMO_LABEL,
    };
  }

  async listDevices(_agencyId: string): Promise<BodyCameraResult<{ devices: BodyCameraDeviceInfo[] }>> {
    return { supported: true, devices: SYNTHETIC_DEVICES };
  }

  async getDeviceStatus(
    _agencyId: string,
    providerDeviceId: string,
  ): Promise<BodyCameraResult<{ device: BodyCameraDeviceInfo }>> {
    const device = SYNTHETIC_DEVICES.find((d) => d.providerDeviceId === providerDeviceId);
    if (!device) {
      return bwcUnsupported("synthetic", "getDeviceStatus", "Device not found");
    }
    return { supported: true, device: { ...device, isStreaming: false } };
  }

  async requestStream(params: {
    tenantId: string;
    agencyId: string;
    sessionId: string;
    deviceId: string;
    providerDeviceId: string;
    officerId: string | null;
    targetKvsChannelName: string | null;
  }): Promise<BodyCameraResult<BodyCameraStreamResult>> {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    // Use the target KVS channel name if provided, else synthesize one
    const kvsChannelName = params.targetKvsChannelName ?? `la-synth-${params.sessionId}`;
    return {
      supported: true,
      providerSessionId: `synth-ps-${randomUUID()}`,
      kvsChannelName,
      kvsStreamArn: null,
      viewerToken: null,
      ingestUrl: null,
      expiresAt,
    };
  }

  async getLocation(
    _agencyId: string,
    providerDeviceId: string,
  ): Promise<BodyCameraResult<{ location: import("rapid-cortex-shared").LiveAssistLocation }>> {
    const device = SYNTHETIC_DEVICES.find((d) => d.providerDeviceId === providerDeviceId);
    if (!device?.isOnline) {
      return bwcUnsupported("synthetic", "getLocation", "Device offline");
    }
    // Simulate a slight position drift each call for demo realism
    const jitter = () => (Math.random() - 0.5) * 0.001;
    return {
      supported: true,
      location: {
        latitude: 29.4241 + jitter(),
        longitude: -98.4936 + jitter(),
        accuracyMeters: 5,
        headingDeg: Math.floor(Math.random() * 360),
        source: "device_gps",
        timestamp: new Date().toISOString(),
      },
    };
  }

  async inviteToCoaching(params: {
    sessionId: string;
    officerEndpointRef: string;
    supervisorDisplayName: string;
    sdpOffer: string | null;
  }): Promise<BodyCameraResult<CoachingInviteResult>> {
    return {
      supported: true,
      channelId: `synth-ch-${randomUUID()}`,
      sdpAnswer: params.sdpOffer ? `v=0\r\n[SYNTHETIC SDP ANSWER for session ${params.sessionId}]` : null,
      immediateAck: true,
    };
  }

  async terminateStream(
    _agencyId: string,
    _providerDeviceId: string,
    _providerSessionId: string,
  ): Promise<BodyCameraResult<{ terminated: boolean }>> {
    return { supported: true, terminated: true };
  }
}
