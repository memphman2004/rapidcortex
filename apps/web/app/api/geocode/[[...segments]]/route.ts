import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/**
 * Legacy Create Incident geocode. Live web still calls
 * `GET /api/geocode/forward?q=…`; canonical is `/api/location/geocode?address=…`.
 */

type Ctx = { params: Promise<{ segments?: string[] }> };

function geocodeSearch(request: NextRequest): string {
  const src = request.nextUrl.searchParams;
  const address = (src.get("address") || src.get("q") || "").trim();
  const qs = new URLSearchParams();
  if (address) qs.set("address", address);
  for (const key of ["lat", "lng"] as const) {
    const value = src.get(key);
    if (value) qs.set(key, value);
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : "";
}

export async function GET(request: NextRequest, _ctx: Ctx) {
  return proxyToAuthUpstream(request, "/api/location/geocode", {
    search: geocodeSearch(request),
  });
}
