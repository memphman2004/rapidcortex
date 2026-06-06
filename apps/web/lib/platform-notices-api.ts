import type { CreateNoticeInput, PlatformNotice } from "rapid-cortex-shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const base = isBrowser ? `${window.location.origin}/api/backend` : "";
  const apiBase =
    base ||
    process.env.API_UPSTREAM_BASE_2?.replace(/\/$/, "") ||
    process.env.API_UPSTREAM_BASE?.replace(/\/$/, "") ||
    "";
  if (!apiBase) throw new Error("API base URL not configured");

  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: isBrowser ? "include" : init?.credentials,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: string }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function createPlatformNotice(input: CreateNoticeInput): Promise<PlatformNotice> {
  return request<PlatformNotice>("/api/admin/notices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAdminPlatformNotices(): Promise<PlatformNotice[]> {
  const data = await request<{ notices?: PlatformNotice[] }>("/api/admin/notices");
  return data.notices ?? [];
}

export async function cancelPlatformNotice(noticeId: string): Promise<void> {
  await request(`/api/admin/notices/${encodeURIComponent(noticeId)}`, { method: "DELETE" });
}

export async function fetchActivePlatformNotices(): Promise<PlatformNotice[]> {
  const data = await request<{ notices?: PlatformNotice[] }>("/api/notices/active");
  return data.notices ?? [];
}

export async function acknowledgePlatformNotice(noticeId: string): Promise<void> {
  await request(`/api/notices/${encodeURIComponent(noticeId)}/ack`, { method: "POST" });
}
