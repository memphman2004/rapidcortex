import type { AlsRouteResult } from "rapid-cortex-shared";

export async function fetchAlsRoute(opts: {
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
}): Promise<AlsRouteResult | null> {
  const qs = new URLSearchParams({
    fromLng: String(opts.fromLng),
    fromLat: String(opts.fromLat),
    toLng: String(opts.toLng),
    toLat: String(opts.toLat),
  });
  const res = await fetch(`/api/location/route?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) return null;
  const body = (await res.json()) as AlsRouteResult;
  if (!Array.isArray(body.geometry)) return null;
  return body;
}
