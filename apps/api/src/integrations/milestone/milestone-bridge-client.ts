/**
 * HTTPS client for the on-prem Milestone Bridge Protocol.
 * A missing bridge URL fails closed. MILESTONE_MOCK does not invent cameras or streams.
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

export class MilestoneBridgeNotConfiguredError extends Error {
  constructor() {
    super("Milestone bridge URL is not configured");
    this.name = "MilestoneBridgeNotConfiguredError";
  }
}

export function milestoneMockEnabled(): boolean {
  const v = process.env.MILESTONE_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
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

  async health(): Promise<MilestoneBridgeHealth> {
    return this.request<MilestoneBridgeHealth>("GET", MILESTONE_BRIDGE_PATHS.health);
  }

  async listCameras(): Promise<MilestoneBridgeCamera[]> {
    const res = await this.request<MilestoneBridgeCameraList>("GET", MILESTONE_BRIDGE_PATHS.cameras);
    return res.cameras ?? [];
  }

  async requestLive(
    cameraId: string,
    body: MilestoneBridgeLiveRequest,
  ): Promise<MilestoneBridgeLiveResponse> {
    return this.request<MilestoneBridgeLiveResponse>(
      "POST",
      MILESTONE_BRIDGE_PATHS.live(cameraId),
      body,
    );
  }

  async sendEvent(body: MilestoneBridgeEventRequest): Promise<MilestoneBridgeEventResponse> {
    return this.request<MilestoneBridgeEventResponse>("POST", MILESTONE_BRIDGE_PATHS.events, body);
  }

  async sendAlarm(body: MilestoneBridgeAlarmRequest): Promise<MilestoneBridgeAlarmResponse> {
    return this.request<MilestoneBridgeAlarmResponse>("POST", MILESTONE_BRIDGE_PATHS.alarms, body);
  }

  private async request<T>(
    method: string,
    path: string,
    bodyObj?: unknown,
  ): Promise<T> {
    const base = this.opts.bridgeBaseUrl?.trim().replace(/\/$/, "") ?? "";
    if (!base) throw new MilestoneBridgeNotConfiguredError();
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
