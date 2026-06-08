import { cookies } from "next/headers";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";

export async function campusUpstreamFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = process.env.API_UPSTREAM_BASE?.trim().replace(/\/$/, "");
  if (!base) {
    return new Response(JSON.stringify({ error: "API_UPSTREAM_BASE is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return fetch(`${base}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
