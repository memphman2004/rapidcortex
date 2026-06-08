import { cookies } from "next/headers";
import type { HospitalCapacity, HospitalPortalContext } from "rapid-cortex-shared";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

async function authHeaders(): Promise<HeadersInit> {
  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function upstreamFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return new Response(
      JSON.stringify({ error: "API_UPSTREAM_BASE is not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  const headers = await authHeaders();
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

export async function fetchHospitalPortalContext(hospitalId?: string): Promise<HospitalPortalContext | null> {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await upstreamFetch(`/api/hospital-portal/context${qs}`);
  if (!res.ok) return null;
  return res.json() as Promise<HospitalPortalContext>;
}

export async function fetchHospitalCapacityHistory(limit = 20): Promise<HospitalCapacity[]> {
  const res = await upstreamFetch(`/api/hospital-portal/capacity/history?limit=${limit}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: HospitalCapacity[] };
  return data.items ?? [];
}

export async function postHospitalCapacityUpdate(body: unknown): Promise<HospitalCapacity | null> {
  const res = await upstreamFetch("/api/hospital-portal/capacity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json() as Promise<HospitalCapacity>;
}

export async function fetchRegionalHospitalCapacity(): Promise<HospitalCapacity[]> {
  const res = await upstreamFetch("/api/hospitals/capacity");
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: HospitalCapacity[] } | HospitalCapacity[];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}
