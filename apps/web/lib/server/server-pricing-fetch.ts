import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";

export async function serverPricingFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = resolveUpstreamApiBase(path);
  if (!base) {
    return new Response(
      JSON.stringify({ error: "API_UPSTREAM_BASE_4 is not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const target = new URL(`${base}${path}`);
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  headers.set("authorization", `Bearer ${token}`);

  return fetch(target, { ...init, headers, cache: "no-store" });
}

export async function serverPricingJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await serverPricingFetch(path, init);
  if (!res.ok) return null;
  return (await res.json()) as T;
}
