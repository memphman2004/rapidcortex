/**
 * HTTPS client for the on-prem Milestone Bridge Protocol.
 * Set MILESTONE_MOCK=1 (or omit bridge URL) to return fixtures for CI / local.
 */

import { createHmac } from "node:crypto";
import {
  MILESTONE_BRIDGE_AUTH,
  MILESTONE_BRIDGE_PATHS,
  type MilestoneBridgeAlarmRequest,
  type MilestoneBridgeAlarmResponse,
  type MilestoneBridgeCamera,
  type MilestoneBridgeCameraList,
  type MilestoneBridgeEventRequest,
  type MilestoneBridgeEventResponse,
  type MilestoneBridgeHealth,
  type MilestoneBridgeLiveRequest,
  type MilestoneBridgeLiveResponse,
} from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";

export function milestoneMockEnabled(): boolean {
  const v = process.env.MILESTONE_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

function mockCameras(): MilestoneBridgeCamera[] {
  return [
    {
      cameraId: "xp-ballantine-1",
      displayName: "Ballantine Hall — Main Entry",
      xprotectGuid: "mock-guid-ballantine-1",
      latitude: 39.1653,
      longitude: -86.5264,
      buildingId: "BALLANTINE",
      floor: "1",
      zoneCode: "BH-1",
      status: "online",
      ptzCapable: false,
    },
    {
      cameraId: "xp-ballantine-2",
      displayName: "Ballantine Hall — Quad",
      xprotectGuid: "mock-guid-ballantine-2",
      latitude: 39.1655,
      longitude: -86.5261,
      buildingId: "BALLANTINE",
      floor: "1",
      zoneCode: "BH-1-QUAD",
      status: "online",
      ptzCapable: true,
    },
    {
      cameraId: "xp-library-1",
      displayName: "Wells Library — East",
      xprotectGuid: "mock-guid-library-1",
      latitude: 39.1678,
      longitude: -86.5195,
      buildingId: "WELLS",
      floor: "1",
      zoneCode: "WL-1",
      status: "online",
      ptzCapable: false,
    },
  ];
}

async function resolveBridgeSecret(secretArn: string | undefined): Promise<string> {
  if (!secretArn?.trim()) return "";
  return resolvePlainOrSecretArn("", secretArn.trim(), { preferredField: "hmacSecret" });
}

function signRequest(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  const payload = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  const hex = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return `${MILESTONE_BRIDGE_AUTH.signaturePrefix}${hex}`;
}

export type MilestoneBridgeClientOpts = {
  bridgeBaseUrl: string;
  credentialsSecretArn?: string;
};

export class MilestoneBridgeClient {
  constructor(private readonly opts: MilestoneBridgeClientOpts) {}

  private useMock(): boolean {
    return milestoneMockEnabled() || !this.opts.bridgeBaseUrl?.trim();
  }

  async health(): Promise<MilestoneBridgeHealth> {
    if (this.useMock()) {
      return { ok: true, xprotectConnected: true, siteLabel: "Mock XProtect", version: "mock-1" };
    }
    return this.request<MilestoneBridgeHealth>("GET", MILESTONE_BRIDGE_PATHS.health);
  }

  async listCameras(): Promise<MilestoneBridgeCamera[]> {
    if (this.useMock()) return mockCameras();
    const res = await this.request<MilestoneBridgeCameraList>("GET", MILESTONE_BRIDGE_PATHS.cameras);
    return res.cameras ?? [];
  }

  async requestLive(
    cameraId: string,
    body: MilestoneBridgeLiveRequest,
  ): Promise<MilestoneBridgeLiveResponse> {
    if (this.useMock()) {
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      return {
        cameraId,
        streamUrl: `https://mock.milestone.local/hls/${encodeURIComponent(cameraId)}.m3u8`,
        format: body.format ?? "hls",
        expiresAt,
        mock: true,
      };
    }
    return this.request<MilestoneBridgeLiveResponse>(
      "POST",
      MILESTONE_BRIDGE_PATHS.live(cameraId),
      body,
    );
  }

  async sendEvent(body: MilestoneBridgeEventRequest): Promise<MilestoneBridgeEventResponse> {
    if (this.useMock()) {
      return { ok: true, bridgeEventId: `mock-evt-${body.incidentId}`, mock: true };
    }
    return this.request<MilestoneBridgeEventResponse>("POST", MILESTONE_BRIDGE_PATHS.events, body);
  }

  async sendAlarm(body: MilestoneBridgeAlarmRequest): Promise<MilestoneBridgeAlarmResponse> {
    if (this.useMock()) {
      return { ok: true, bridgeEventId: `mock-alm-${body.incidentId}`, mock: true };
    }
    return this.request<MilestoneBridgeAlarmResponse>("POST", MILESTONE_BRIDGE_PATHS.alarms, body);
  }

  private async request<T>(
    method: string,
    path: string,
    bodyObj?: unknown,
  ): Promise<T> {
    const base = this.opts.bridgeBaseUrl.replace(/\/$/, "");
    const url = `${base}${path}`;
    const body = bodyObj === undefined ? "" : JSON.stringify(bodyObj);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const secret = await resolveBridgeSecret(this.opts.credentialsSecretArn);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      [MILESTONE_BRIDGE_AUTH.timestampHeader]: timestamp,
    };
    if (secret) {
      headers[MILESTONE_BRIDGE_AUTH.signatureHeader] = signRequest(
        secret,
        timestamp,
        method,
        path,
        body,
      );
    }

    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body || undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Milestone bridge ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }
}
