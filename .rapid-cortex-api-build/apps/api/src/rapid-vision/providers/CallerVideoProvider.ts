import type {
  CameraProvider,
  ConsentRequestParams,
  DiscoveredDevice,
  OpenStreamParams,
  OpenStreamResult,
  ProviderHealthResult,
  ProviderIdentity,
  RecordedClipParams,
} from "./CameraProvider.js";
import { unsupported } from "./CameraProvider.js";
import type { ProviderResult } from "rapid-cortex-shared";

interface VideoAssistSession {
  sessionId: string;
  incidentId: string;
  agencyId: string;
  kvsChannelName: string;
  kvsStreamArn: string | null;
  status: "active" | "ended" | "expired";
  startedAt: string;
  expiresAt: string;
}

type VideoAssistRepository = {
  getActiveSessionForIncident: (
    agencyId: string,
    incidentId: string,
  ) => Promise<VideoAssistSession | null>;
};

/** Wraps existing Video Assist KVS sessions as a Rapid Vision™ source. */
export class CallerVideoProvider implements CameraProvider {
  readonly identity: ProviderIdentity = {
    provider: "caller_video",
    displayName: "Caller Video",
    supportsOAuth: false,
    supportsRTSP: false,
    supportsConsentRequests: false,
    requiresOwnerConsent: false,
    defaultConsentPolicy: "preauthorized_emergency",
    supportedCapabilities: ["live_stream", "audio"],
  };

  constructor(private readonly videoAssistRepo: VideoAssistRepository) {}

  async getHealth(_agencyId: string): Promise<ProviderHealthResult> {
    return {
      status: "online",
      lastChecked: new Date().toISOString(),
      detail: "Caller video depends on an active Video Assist session",
    };
  }

  async discoverDevices(
    _agencyId: string,
  ): Promise<ProviderResult<{ devices: DiscoveredDevice[] }>> {
    return { supported: true, devices: [] };
  }

  async getDeviceStatus(
    agencyId: string,
    providerDeviceId: string,
  ): Promise<ProviderResult<{ online: boolean; lastSeen?: string }>> {
    const session = await this.videoAssistRepo.getActiveSessionForIncident(
      agencyId,
      providerDeviceId,
    );
    return {
      supported: true,
      online: session?.status === "active",
      lastSeen: session?.startedAt,
    };
  }

  async requestConsent(_params: ConsentRequestParams): Promise<ProviderResult<never>> {
    return unsupported(
      "caller_video",
      "requestConsent",
      "Caller video consent is handled by Video Assist. Rapid Vision™ uses the existing authorized session.",
    );
  }

  async openLiveStream(
    params: OpenStreamParams,
  ): Promise<ProviderResult<OpenStreamResult>> {
    const session = await this.videoAssistRepo.getActiveSessionForIncident(
      params.agencyId,
      params.incidentId,
    );
    if (!session || session.status !== "active") {
      return unsupported(
        "caller_video",
        "openLiveStream",
        "No active caller video session for this incident.",
      );
    }
    return {
      supported: true,
      providerSessionId: session.sessionId,
      kvsChannelName: session.kvsChannelName,
      kvsStreamArn: session.kvsStreamArn,
      expiresAt: session.expiresAt,
    };
  }

  async getRecordedClip(_params: RecordedClipParams): Promise<ProviderResult<never>> {
    return unsupported(
      "caller_video",
      "getRecordedClip",
      "Caller video clip retrieval is not supported in this release.",
    );
  }

  async closeSession(): Promise<{ success: boolean }> {
    return { success: true };
  }

  async revokeIncidentAccess(): Promise<{ revokedCount: number }> {
    return { revokedCount: 0 };
  }
}
