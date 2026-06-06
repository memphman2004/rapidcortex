import type { ConnectSource } from "../connect-types.js";

export interface RingAdapterConfig {
  partnershipEnabled: boolean;
  apiBaseUrl?: string;
  partnerTokenSecretArn?: string;
}

export class RingAdapter {
  private readonly config: RingAdapterConfig;

  constructor() {
    this.config = {
      partnershipEnabled: process.env.RING_PARTNERSHIP_ENABLED === "true",
      apiBaseUrl: process.env.RING_API_BASE_URL,
      partnerTokenSecretArn: process.env.RING_PARTNER_TOKEN_SECRET_ARN,
    };
  }

  isAvailable(): boolean {
    return (
      this.config.partnershipEnabled &&
      Boolean(this.config.apiBaseUrl) &&
      Boolean(this.config.partnerTokenSecretArn)
    );
  }

  async resolveStreamUrl(source: ConnectSource): Promise<string> {
    if (this.isAvailable()) {
      try {
        throw new Error("Ring partner live-view API client is not implemented yet");
      } catch (err) {
        console.warn("[ring-adapter] Ring API path failed, checking RTSP fallback:", err);
      }
    }
    if (this.canUseRtspFallback(source) && source.rtspUrl) {
      return source.rtspUrl;
    }
    throw new Error(
      `Ring device ${source.sourceId}: Ring partnership not enabled and no RTSP fallback configured. ` +
        "To enable: set RING_PARTNERSHIP_ENABLED=true and RING_CREDENTIALS_SECRET_ARN, " +
        "or register the device with an rtspUrl for the RTSP fallback path.",
    );
  }

  canUseRtspFallback(source: ConnectSource): boolean {
    return source.protocol === "RTSP" && Boolean(source.rtspUrl);
  }
}

export const ringAdapter = new RingAdapter();
