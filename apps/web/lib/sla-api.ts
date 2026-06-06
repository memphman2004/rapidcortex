import type {
  BacklogSnapshot,
  PutSlaThresholdsBody,
  SlaStatus,
  SlaThreshold,
} from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";

const USE_AUTH_PROXY =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_AUTH_PROXY === "1";

const DIRECT_API_BASE =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "")
    : "";

function apiBase(): string {
  if (USE_AUTH_PROXY) {
    if (typeof window !== "undefined") return `${window.location.origin}/api/backend`;
    const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    return site ? `${site}/api/backend` : "http://127.0.0.1:3000/api/backend";
  }
  return DIRECT_API_BASE;
}

async function slaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: USE_AUTH_PROXY ? "include" : "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request failed ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

export function isSlaApiConfigured(): boolean {
  return isApiConfigured();
}

export async function fetchSlaStatus(): Promise<SlaStatus[]> {
  const data = await slaRequest<{ items: SlaStatus[] }>("/api/sla/status");
  return data.items;
}

export async function fetchSlaBacklog(): Promise<BacklogSnapshot> {
  return slaRequest<BacklogSnapshot>("/api/sla/backlog");
}

export async function fetchSlaHistory(period: "24h" | "7d" = "24h"): Promise<BacklogSnapshot[]> {
  const data = await slaRequest<{ items: BacklogSnapshot[] }>(
    `/api/sla/history?period=${encodeURIComponent(period)}`,
  );
  return data.items;
}

export async function fetchSlaThresholds(): Promise<SlaThreshold[]> {
  const data = await slaRequest<{ thresholds: SlaThreshold[] }>("/api/sla/thresholds");
  return data.thresholds;
}

export async function putSlaThresholds(body: PutSlaThresholdsBody): Promise<SlaThreshold[]> {
  const data = await slaRequest<{ thresholds: SlaThreshold[] }>("/api/sla/thresholds", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.thresholds;
}
