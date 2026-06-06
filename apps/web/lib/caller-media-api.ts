import type {
  CallerMediaSendLinkBody,
  CallerMediaSendLinkResponse,
  CallerMediaUploadUrlBody,
  CallerMediaUploadUrlResponse,
  IncidentMediaListItem,
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

async function mediaRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function isCallerMediaApiConfigured(): boolean {
  return isApiConfigured();
}

export async function fetchCallerMedia(incidentId: string): Promise<IncidentMediaListItem[]> {
  const data = await mediaRequest<{ items: IncidentMediaListItem[] }>(
    `/api/incidents/${encodeURIComponent(incidentId)}/media`,
  );
  return data.items;
}

export async function postCallerMediaSendLink(
  incidentId: string,
  body: CallerMediaSendLinkBody,
): Promise<CallerMediaSendLinkResponse> {
  return mediaRequest(`/api/incidents/${encodeURIComponent(incidentId)}/media/send-link`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postCallerMediaUploadUrl(
  incidentId: string,
  body: CallerMediaUploadUrlBody,
): Promise<CallerMediaUploadUrlResponse> {
  return mediaRequest(`/api/incidents/${encodeURIComponent(incidentId)}/media/upload-url`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteCallerMedia(incidentId: string, mediaId: string): Promise<void> {
  await mediaRequest<unknown>(`/api/incidents/${encodeURIComponent(incidentId)}/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
  });
}
