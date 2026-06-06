import type { LinkedRingDevice, RingDeviceType } from "./ring-types.js";
import { RingAuthError, RingDeviceDiscoveryError } from "./ring-errors.js";

const RING_CLIENT_API_BASE = "https://api.ring.com/clients_api";
const MAX_RETRIES = 3;
const INITIAL_RETRY_MS = 500;

type RingDevicesResponse = {
  doorbots?: RingRawDevice[];
  authorized_doorbots?: RingRawDevice[];
  stickup_cams?: RingRawDevice[];
  chimes?: RingRawDevice[];
  [key: string]: unknown;
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

  async getDevices(): Promise<LinkedRingDevice[]> {
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

  private async requestJson<T>(method: string, path: string): Promise<T> {
    const url = `${RING_CLIENT_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
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

      console.log(
        JSON.stringify({
          msg: "ring_api_request",
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
