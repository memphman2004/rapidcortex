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
import type { ProviderResult } from "rapid-cortex-shared";

type RingDeviceService = {
  getDevicesForAgency: (agencyId: string) => Promise<RingDeviceRecord[]>;
  getDeviceById: (agencyId: string, deviceId: string) => Promise<RingDeviceRecord | null>;
};

type RingEmergencyRepository = {
  createRequest: (params: RingCreateRequestParams) => Promise<RingEmergencyRequest>;
  getSessionById: (sessionId: string) => Promise<RingStreamSession | null>;
  closeSession: (sessionId: string) => Promise<void>;
  listActiveSessionsForIncident: (
    agencyId: string,
    incidentId: string,
  ) => Promise<RingStreamSession[]>;
};

interface RingDeviceRecord {
  deviceId: string;
  deviceName: string;
  deviceType: "doorbell" | "stickup_cam" | "authorized_doorbell";
  latitude: number | null;
  longitude: number | null;
  isEnabledForConnect: boolean;
  isOnline?: boolean;
}

interface RingCreateRequestParams {
  incidentId: string;
  agencyId: string;
  deviceId: string;
  requestedDurationMinutes: number;
  agencyDisplayName: string;
  incidentReason: string;
}

interface RingEmergencyRequest {
  requestId: string;
  requestTokenHash: string;
  approveUrl: string;
  declineUrl: string;
  expiresAt: string;
}

interface RingStreamSession {
  sessionId: string;
  incidentId: string;
  agencyId: string;
  deviceId: string;
  streamReference: string | null;
  streamStatus: "ACTIVE" | "PENDING" | "EXPIRED" | "REVOKED";
  expiresAt: string;
}

/** Rapid Vision™ — Ring Source. Wraps Stack 4 Ring APIs; does not duplicate OAuth/consent. */
export class RingVisionProvider implements CameraProvider {
  readonly identity: ProviderIdentity = {
    provider: "ring",
    displayName: "Ring",
    supportsOAuth: true,
    supportsRTSP: false,
    supportsConsentRequests: true,
    requiresOwnerConsent: true,
    defaultConsentPolicy: "ask_every_time",
    supportedCapabilities: ["live_stream"],
  };

  constructor(
    private readonly ringDevices: RingDeviceService,
    private readonly ringRepo: RingEmergencyRepository,
  ) {}

  async getHealth(agencyId: string): Promise<ProviderHealthResult> {
    try {
      const devices = await this.ringDevices.getDevicesForAgency(agencyId);
      return {
        status: devices.length > 0 ? "online" : "unknown",
        lastChecked: new Date().toISOString(),
        detail: `${devices.length} Ring device(s) linked for agency`,
      };
    } catch (err) {
      return {
        status: "offline",
        lastChecked: new Date().toISOString(),
        detail: err instanceof Error ? err.message : "Ring health check failed",
      };
    }
  }

  async discoverDevices(
    agencyId: string,
  ): Promise<ProviderResult<{ devices: DiscoveredDevice[] }>> {
    const ringDevices = await this.ringDevices.getDevicesForAgency(agencyId);
    const devices: DiscoveredDevice[] = ringDevices
      .filter((d) => d.isEnabledForConnect && d.latitude !== null && d.longitude !== null)
      .map((d) => ({
        providerDeviceId: d.deviceId,
        friendlyName: d.deviceName,
        cameraType: "doorbell" as const,
        latitude: d.latitude,
        longitude: d.longitude,
        isOnline: d.isOnline ?? true,
        capabilities: ["live_stream" as const],
      }));
    return { supported: true, devices };
  }

  async getDeviceStatus(
    agencyId: string,
    providerDeviceId: string,
  ): Promise<ProviderResult<{ online: boolean; lastSeen?: string }>> {
    const device = await this.ringDevices.getDeviceById(agencyId, providerDeviceId);
    if (!device) {
      return unsupported("ring", "getDeviceStatus", "Device not found or not linked to this agency.");
    }
    return { supported: true, online: device.isOnline ?? true };
  }

  async requestConsent(
    params: ConsentRequestParams,
  ): Promise<ProviderResult<ConsentRequestResult>> {
    const request = await this.ringRepo.createRequest({
      incidentId: params.incidentId,
      agencyId: params.agencyId,
      deviceId: params.providerDeviceId,
      requestedDurationMinutes: params.requestedDurationMinutes,
      agencyDisplayName: params.agencyDisplayName,
      incidentReason: params.incidentReason,
    });
    return {
      supported: true,
      requestId: request.requestId,
      tokenHash: request.requestTokenHash,
      approveUrl: request.approveUrl,
      declineUrl: request.declineUrl,
      deliveryMethod: "sms",
      expiresAt: request.expiresAt,
    };
  }

  async openLiveStream(
    params: OpenStreamParams,
  ): Promise<ProviderResult<OpenStreamResult>> {
    const session = await this.ringRepo.getSessionById(params.sessionId);
    if (!session || session.streamStatus !== "ACTIVE") {
      return unsupported(
        "ring",
        "openLiveStream",
        "Ring stream session is not active. Owner consent may be pending.",
      );
    }
    return {
      supported: true,
      providerSessionId: session.sessionId,
      kvsChannelName: session.streamReference,
      kvsStreamArn: session.streamReference,
      expiresAt: session.expiresAt,
    };
  }

  async getRecordedClip(
    _params: RecordedClipParams,
  ): Promise<ProviderResult<never>> {
    return unsupported(
      "ring",
      "getRecordedClip",
      "Ring recorded clip retrieval is not currently supported. Live stream only during the authorized window.",
    );
  }

  async closeSession(
    _agencyId: string,
    providerSessionId: string,
  ): Promise<{ success: boolean; detail?: string }> {
    try {
      await this.ringRepo.closeSession(providerSessionId);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        detail: err instanceof Error ? err.message : "Session close failed",
      };
    }
  }

  async revokeIncidentAccess(
    agencyId: string,
    incidentId: string,
  ): Promise<{ revokedCount: number }> {
    const sessions = await this.ringRepo.listActiveSessionsForIncident(agencyId, incidentId);
    let revokedCount = 0;
    for (const session of sessions) {
      const result = await this.closeSession(agencyId, session.sessionId);
      if (result.success) revokedCount += 1;
    }
    return { revokedCount };
  }
}
