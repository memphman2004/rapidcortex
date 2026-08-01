import type { LinkedRingDevice, RingDeviceType } from "./ring-types.js";
import { RingAuthError, RingDeviceDiscoveryError } from "./ring-errors.js";

const RING_CLIENT_API_BASE = "https://api.ring.com/clients_api";
const RING_PARTNER_API_BASE = "https://api.amazonvision.com/v1";
const MAX_RETRIES = 3;
const INITIAL_RETRY_MS = 500;

export type RingPartnerUserProfile = {
  accountId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
};

type RingPartnerUserResponse = {
  data?: {
    id?: string;
    attributes?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone_number?: string;
    };
  };
};

type RingDevicesResponse = {
  doorbots?: RingRawDevice[];
  authorized_doorbots?: RingRawDevice[];
  stickup_cams?: RingRawDevice[];
  chimes?: RingRawDevice[];
  [key: string]: unknown;
};

/** Amazon Vision / Ring Appstore device discovery (JSON:API). */
type RingPartnerDevicesResponse = {
  data?: Array<{
    type?: string;
    id?: string;
    attributes?: {
      name?: string;
      kind?: string;
      device_type?: string;
    };
  }>;
};

type RingRawDevice = {
  id?: number | string;
  device_id?: string;
  description?: string;
  kind?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  location?: string | null;
};

function mapDeviceType(kind: string | undefined): RingDeviceType {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("doorbot") || k.includes("doorbell")) return "DOORBELL";
  if (k.includes("stickup") || k.includes("camera") || k.includes("onvif")) return "CAMERA";
  return "UNKNOWN";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

export class RingApiClient {
  constructor(private readonly accessToken: string) {}

  /**
   * List devices authorized for this Appstore OAuth token.
   * Uses Amazon Vision Device Discovery (`GET /v1/devices`) — Appstore AVA tokens
   * do not work against legacy `api.ring.com/clients_api/ring_devices`.
   * Location is country/state only from Ring; callers must stamp fallback GPS for proximity.
   */
  async getDevices(): Promise<LinkedRingDevice[]> {
    try {
      return await this.getPartnerDevices();
    } catch (err) {
      // Legacy fallback for non-Appstore consumer tokens only.
      if (!(err instanceof RingAuthError)) throw err;
      console.warn(
        JSON.stringify({
          msg: "ring_partner_devices_auth_failed_fallback_clients_api",
          error: err.message,
        }),
      );
      return this.getLegacyClientDevices();
    }
  }

  /** Appstore / AVA device discovery. */
  private async getPartnerDevices(): Promise<LinkedRingDevice[]> {
    const payload = await this.requestPartnerJson<RingPartnerDevicesResponse>(
      "GET",
      "/devices?include=status",
    );
    const now = new Date().toISOString();
    const devices: LinkedRingDevice[] = [];
    for (const item of payload.data ?? []) {
      const deviceId = item.id?.trim();
      if (!deviceId) continue;
      const name = item.attributes?.name?.trim() || `Ring device ${deviceId}`;
      const kind = item.attributes?.kind ?? item.attributes?.device_type;
      devices.push({
        agencyId: "",
        userId: "",
        ringAccountId: "",
        deviceId,
        deviceName: name,
        deviceType: mapDeviceType(kind),
        locationLabel: null,
        latitude: null,
        longitude: null,
        isEnabledForConnect: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    return devices;
  }

  /** Legacy consumer clients_api (not used for Appstore AVA tokens). */
  private async getLegacyClientDevices(): Promise<LinkedRingDevice[]> {
    const payload = await this.requestJson<RingDevicesResponse>("GET", "/ring_devices");
    const raw: RingRawDevice[] = [
      ...(payload.doorbots ?? []),
      ...(payload.authorized_doorbots ?? []),
      ...(payload.stickup_cams ?? []),
    ];
    const now = new Date().toISOString();
    return raw
      .map((device) => this.mapRawDevice(device, now))
      .filter((d): d is LinkedRingDevice => d !== null);
  }

  async getDeviceById(deviceId: string): Promise<LinkedRingDevice | null> {
    const devices = await this.getDevices();
    return devices.find((d) => d.deviceId === deviceId) ?? null;
  }

  /**
   * Ring Partner Users API — stable account id (`data.id`) survives token rotation and re-link.
   * @see https://developer.amazon.com/docs/ring/api-documentation.html
   */
  async getPartnerUserProfile(): Promise<RingPartnerUserProfile> {
    const payload = await this.requestPartnerJson<RingPartnerUserResponse>("GET", "/users/me");
    const accountId = payload.data?.id?.trim();
    if (!accountId) {
      throw new RingAuthError("Ring partner API did not return account id");
    }
    const attrs = payload.data?.attributes;
    return {
      accountId,
      firstName: attrs?.first_name?.trim() || undefined,
      lastName: attrs?.last_name?.trim() || undefined,
      email: attrs?.email?.trim() || undefined,
      phoneNumber: attrs?.phone_number?.trim() || undefined,
    };
  }

  private mapRawDevice(device: RingRawDevice, now: string): LinkedRingDevice | null {
    const id = device.id ?? device.device_id;
    if (id === undefined || id === null || id === "") return null;
    const deviceId = String(id);
    const lat = device.latitude ?? null;
    const lon = device.longitude ?? null;
    return {
      agencyId: "",
      userId: "",
      ringAccountId: "",
      deviceId,
      deviceName: (device.description ?? `Ring device ${deviceId}`).trim(),
      deviceType: mapDeviceType(device.kind),
      locationLabel: device.address ?? device.location ?? null,
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lon === "number" ? lon : null,
      isEnabledForConnect: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async requestPartnerJson<T>(method: string, path: string): Promise<T> {
    const url = `${RING_PARTNER_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    return this.requestJsonAtUrl<T>(method, url, "ring_partner_api_request");
  }

  private async requestJson<T>(method: string, path: string): Promise<T> {
    const url = `${RING_CLIENT_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    return this.requestJsonAtUrl<T>(method, url, "ring_api_request");
  }

  private async requestJsonAtUrl<T>(
    method: string,
    url: string,
    logMsg: "ring_api_request" | "ring_partner_api_request",
  ): Promise<T> {
    let attempt = 0;
    let delayMs = INITIAL_RETRY_MS;

    while (true) {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json",
        },
      });

      const path = new URL(url).pathname;
      console.log(
        JSON.stringify({
          msg: logMsg,
          method,
          path,
          status: response.status,
        }),
      );

      if (response.status === 401) {
        throw new RingAuthError("Ring API rejected the access token", { status: 401 });
      }

      if (response.status === 404) {
        throw new RingDeviceDiscoveryError("Ring API resource not found", { status: 404, path });
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          throw new RingDeviceDiscoveryError("Ring API request failed after retries", {
            status: response.status,
            path,
          });
        }
        const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
        await sleep(retryAfter ?? delayMs);
        attempt += 1;
        delayMs *= 2;
        continue;
      }

      if (!response.ok) {
        throw new RingDeviceDiscoveryError("Ring API request failed", {
          status: response.status,
          path,
        });
      }

      try {
        return (await response.json()) as T;
      } catch {
        throw new RingDeviceDiscoveryError("Ring API returned invalid JSON", { path });
      }
    }
  }
}
