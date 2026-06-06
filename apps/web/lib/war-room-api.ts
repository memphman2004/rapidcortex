import type {
  CreateWarRoomBody,
  PostWarRoomMessageBody,
  WarRoom,
  WarRoomMessage,
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

async function warRoomRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function isWarRoomApiConfigured(): boolean {
  return isApiConfigured();
}

export async function createWarRoom(body: CreateWarRoomBody): Promise<WarRoom> {
  return warRoomRequest<WarRoom>("/api/war-rooms", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchWarRooms(incidentId?: string): Promise<WarRoom[]> {
  const q = incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : "";
  const data = await warRoomRequest<{ items: WarRoom[] }>(`/api/war-rooms${q}`);
  return data.items;
}

export async function fetchWarRoom(roomId: string): Promise<WarRoom> {
  return warRoomRequest<WarRoom>(`/api/war-rooms/${encodeURIComponent(roomId)}`);
}

export async function joinWarRoom(roomId: string): Promise<WarRoom> {
  return warRoomRequest<WarRoom>(`/api/war-rooms/${encodeURIComponent(roomId)}/join`, { method: "POST" });
}

export async function leaveWarRoom(roomId: string): Promise<WarRoom> {
  return warRoomRequest<WarRoom>(`/api/war-rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
}

export async function postWarRoomMessage(roomId: string, body: PostWarRoomMessageBody): Promise<WarRoomMessage> {
  return warRoomRequest<WarRoomMessage>(`/api/war-rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchWarRoomMessages(roomId: string): Promise<WarRoomMessage[]> {
  const data = await warRoomRequest<{ items: WarRoomMessage[] }>(
    `/api/war-rooms/${encodeURIComponent(roomId)}/messages`,
  );
  return data.items;
}

export async function pinWarRoomMessage(roomId: string, messageId: string): Promise<WarRoomMessage> {
  return warRoomRequest<WarRoomMessage>(
    `/api/war-rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/pin`,
    { method: "PATCH" },
  );
}

export async function closeWarRoom(roomId: string): Promise<WarRoom> {
  return warRoomRequest<WarRoom>(`/api/war-rooms/${encodeURIComponent(roomId)}/close`, { method: "POST" });
}
