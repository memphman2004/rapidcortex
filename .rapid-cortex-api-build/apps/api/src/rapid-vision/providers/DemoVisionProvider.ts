import { randomUUID } from "node:crypto";
import type {
  CameraProvider,
  ConsentRequestParams,
  ConsentRequestResult,
  DiscoveredDevice,
  OpenStreamParams,
  OpenStreamResult,
  ProviderHealthResult,
  ProviderIdentity,
  RecordedClipParams,
} from "./CameraProvider.js";
import { unsupported } from "./CameraProvider.js";
import type { ObservationConfidence, ProviderResult } from "rapid-cortex-shared";

const DEMO_DISCLAIMER = "[DEMO MODE — Simulated data. Not a real camera connection.]";

const DEMO_DEVICES: DiscoveredDevice[] = [
  {
    providerDeviceId: "demo-device-001",
    friendlyName: "Demo — Oak St & 3rd Ave (Doorbell)",
    cameraType: "doorbell",
    latitude: 0,
    longitude: 0,
    isOnline: true,
    capabilities: ["live_stream"],
  },
  {
    providerDeviceId: "demo-device-002",
    friendlyName: "Demo — Main St Parking Camera",
    cameraType: "fixed_outdoor",
    latitude: 0,
    longitude: 0,
    isOnline: true,
    capabilities: ["live_stream", "motion_detection"],
  },
  {
    providerDeviceId: "demo-device-003",
    friendlyName: "Demo — Corner Store Exterior",
    cameraType: "fixed_outdoor",
    latitude: 0,
    longitude: 0,
    isOnline: false,
    capabilities: ["live_stream"],
  },
];

export class DemoVisionProvider implements CameraProvider {
  readonly identity: ProviderIdentity = {
    provider: "demo",
    displayName: "DEMO — Simulated Camera",
    supportsOAuth: false,
    supportsRTSP: false,
    supportsConsentRequests: true,
    requiresOwnerConsent: true,
    defaultConsentPolicy: "ask_every_time",
    supportedCapabilities: ["live_stream"],
  };

  async getHealth(_agencyId: string): Promise<ProviderHealthResult> {
    return {
      status: "online",
      lastChecked: new Date().toISOString(),
      detail: DEMO_DISCLAIMER,
    };
  }

  async discoverDevices(
    _agencyId: string,
  ): Promise<ProviderResult<{ devices: DiscoveredDevice[] }>> {
    return { supported: true, devices: DEMO_DEVICES };
  }

  async getDeviceStatus(
    _agencyId: string,
    providerDeviceId: string,
  ): Promise<ProviderResult<{ online: boolean; lastSeen?: string }>> {
    const device = DEMO_DEVICES.find((d) => d.providerDeviceId === providerDeviceId);
    return {
      supported: true,
      online: device?.isOnline ?? false,
      lastSeen: new Date().toISOString(),
    };
  }

  async requestConsent(
    _params: ConsentRequestParams,
  ): Promise<ProviderResult<ConsentRequestResult>> {
    const requestId = `demo-request-${randomUUID()}`;
    const baseUrl = process.env.APP_PUBLIC_BASE_URL ?? "https://app.rapidcortex.us";
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return {
      supported: true,
      requestId,
      tokenHash: `demo-hash-${requestId}`,
      approveUrl: `${baseUrl}/api/public/vision/consent/${requestId}/approve`,
      declineUrl: `${baseUrl}/api/public/vision/consent/${requestId}/decline`,
      deliveryMethod: "sms",
      expiresAt,
    };
  }

  async openLiveStream(params: OpenStreamParams): Promise<ProviderResult<OpenStreamResult>> {
    const expiresAt = new Date(Date.now() + params.durationMinutes * 60_000).toISOString();
    return {
      supported: true,
      providerSessionId: `demo-session-${params.sessionId}`,
      kvsChannelName: null,
      kvsStreamArn: null,
      expiresAt,
    };
  }

  async getRecordedClip(_params: RecordedClipParams): Promise<ProviderResult<never>> {
    return unsupported(
      "demo",
      "getRecordedClip",
      `${DEMO_DISCLAIMER} Recorded clips are not available in demo mode.`,
    );
  }

  async closeSession(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async revokeIncidentAccess(): Promise<{ revokedCount: number }> {
    return { revokedCount: 0 };
  }
}

export const DEMO_OBSERVATION_SCRIPT: Array<{
  delaySeconds: number;
  cameraIndex: number;
  category: string;
  narrative: string;
  confidence: ObservationConfidence;
  correlationSummary?: string;
}> = [
  {
    delaySeconds: 8,
    cameraIndex: 0,
    category: "SCENE_DESCRIPTION",
    narrative:
      "[DEMO] Camera 1 — Oak St & 3rd Ave: Quiet residential sidewalk. No foot traffic " +
      "currently visible. Street well-lit. Parked vehicles on both sides.",
    confidence: "HIGH",
  },
  {
    delaySeconds: 22,
    cameraIndex: 0,
    category: "PERSON",
    narrative:
      "[DEMO] Camera 1 — Oak St & 3rd Ave: Person observed entering the frame from the " +
      "south end of Oak Street. Individual wearing gray hooded sweatshirt and dark pants. " +
      "Moving northbound at a fast walk or light jog.",
    confidence: "HIGH",
    correlationSummary:
      "[DEMO] Possible match to caller description: gray hoodie, moving northbound. " +
      "Caller stated subject fled north on Oak Street.",
  },
  {
    delaySeconds: 45,
    cameraIndex: 1,
    category: "VEHICLE",
    narrative:
      "[DEMO] Camera 2 — Main St Parking: Dark-colored SUV, possibly black or dark gray, " +
      "turning left onto Main Street from the parking lot exit. One occupant visible.",
    confidence: "MEDIUM",
  },
  {
    delaySeconds: 68,
    cameraIndex: 0,
    category: "PERSON",
    narrative:
      "[DEMO] Camera 1 — Oak St & 3rd Ave: Same individual now crossing 3rd Avenue intersection. " +
      "Pace increased. Individual glanced toward camera. Gray hoodie confirmed. Continuing northbound.",
    confidence: "HIGH",
  },
  {
    delaySeconds: 90,
    cameraIndex: 1,
    category: "SCENE_DESCRIPTION",
    narrative:
      "[DEMO] Camera 2 — Main St Parking: Dark SUV has exited view. Parking lot now clear. " +
      "No further movement from this camera angle.",
    confidence: "HIGH",
  },
];
