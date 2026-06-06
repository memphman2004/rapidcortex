import type {
  CreateStakeholderPageBody,
  PatchStakeholderPageBody,
  PublicStakeholderStatusView,
  StakeholderPageInternal,
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

async function stakeholderRequest<T>(path: string, init?: RequestInit): Promise<T> {
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

export function isStakeholderApiConfigured(): boolean {
  return isApiConfigured();
}

export async function createStakeholderPage(body: CreateStakeholderPageBody): Promise<StakeholderPageInternal> {
  return stakeholderRequest("/api/stakeholder-pages", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchStakeholderPages(incidentId: string): Promise<StakeholderPageInternal[]> {
  const data = await stakeholderRequest<{ items: StakeholderPageInternal[] }>(
    `/api/stakeholder-pages?incidentId=${encodeURIComponent(incidentId)}`,
  );
  return data.items;
}

export async function fetchStakeholderPage(pageId: string): Promise<StakeholderPageInternal> {
  return stakeholderRequest(`/api/stakeholder-pages/${encodeURIComponent(pageId)}`);
}

export async function patchStakeholderPage(
  pageId: string,
  body: PatchStakeholderPageBody,
): Promise<StakeholderPageInternal> {
  return stakeholderRequest(`/api/stakeholder-pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteStakeholderPage(pageId: string): Promise<void> {
  await stakeholderRequest(`/api/stakeholder-pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
}

export function publicStakeholderStatusUrl(slug: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/status/${encodeURIComponent(slug)}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  return site ? `${site}/status/${encodeURIComponent(slug)}` : `/status/${encodeURIComponent(slug)}`;
}

export async function fetchPublicStakeholderStatus(
  slug: string,
  pagePassword?: string,
): Promise<PublicStakeholderStatusView> {
  const base = apiBase() || (typeof window !== "undefined" ? `${window.location.origin}/api/backend` : "");
  if (!base) throw new Error("API base URL not configured");
  const res = await fetch(`${base}/api/public/status/${encodeURIComponent(slug)}`, {
    headers: pagePassword ? { "X-Page-Password": pagePassword } : undefined,
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
  return body as PublicStakeholderStatusView;
}
