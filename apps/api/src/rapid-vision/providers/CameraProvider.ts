import type {
  CameraCapability,
  CameraConnectionStatus,
  ConsentPolicy,
  ProviderResult,
  VisionCamera,
  VisionProvider,
} from "rapid-cortex-shared";

export interface ProviderIdentity {
  provider: VisionProvider;
  displayName: string;
  supportsOAuth: boolean;
  supportsRTSP: boolean;
  supportsConsentRequests: boolean;
  requiresOwnerConsent: boolean;
  defaultConsentPolicy: ConsentPolicy;
  supportedCapabilities: CameraCapability[];
}

export interface DiscoveredDevice {
  providerDeviceId: string;
  friendlyName: string;
  cameraType: VisionCamera["cameraType"];
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  capabilities: CameraCapability[];
}

export interface ConsentRequestParams {
  incidentId: string;
  agencyId: string;
  agencyDisplayName: string;
  incidentReason: string;
  requestedDurationMinutes: number;
  cameraId: string;
  providerDeviceId: string;
  ownerId: string;
  ownerContactInfo: string;
}

export interface ConsentRequestResult {
  requestId: string;
  tokenHash: string;
  approveUrl: string;
  declineUrl: string;
  deliveryMethod: "sms" | "email" | "push";
  expiresAt: string;
}

export interface OpenStreamParams {
  incidentId: string;
  agencyId: string;
  cameraId: string;
  providerDeviceId: string;
  sessionId: string;
  durationMinutes: number;
}

export interface OpenStreamResult {
  providerSessionId: string;
  kvsChannelName: string | null;
  kvsStreamArn: string | null;
  expiresAt: string;
}

export interface RecordedClipParams {
  providerDeviceId: string;
  startTime: string;
  endTime: string;
  sessionId: string;
}

export interface RecordedClipResult {
  clipUrl: string;
  expiresAt: string;
  durationSeconds: number;
}

export interface ProviderHealthResult {
  status: CameraConnectionStatus;
  lastChecked: string;
  detail?: string;
}

export interface CameraProvider {
  readonly identity: ProviderIdentity;
  getHealth(agencyId: string): Promise<ProviderHealthResult>;
  discoverDevices(agencyId: string): Promise<ProviderResult<{ devices: DiscoveredDevice[] }>>;
  getDeviceStatus(
    agencyId: string,
    providerDeviceId: string,
  ): Promise<ProviderResult<{ online: boolean; lastSeen?: string }>>;
  requestConsent(params: ConsentRequestParams): Promise<ProviderResult<ConsentRequestResult>>;
  openLiveStream(params: OpenStreamParams): Promise<ProviderResult<OpenStreamResult>>;
  getRecordedClip(params: RecordedClipParams): Promise<ProviderResult<RecordedClipResult>>;
  closeSession(
    agencyId: string,
    providerSessionId: string,
  ): Promise<{ success: boolean; detail?: string }>;
  revokeIncidentAccess(
    agencyId: string,
    incidentId: string,
  ): Promise<{ revokedCount: number }>;
}

export function unsupported(
  provider: VisionProvider,
  capability: string,
  message: string,
): ProviderResult<never> {
  return {
    supported: false,
    code: "UNSUPPORTED_PROVIDER_CAPABILITY",
    provider,
    capability,
    message,
  };
}
