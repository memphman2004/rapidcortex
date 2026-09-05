import { NextResponse } from "next/server";
import type { AgencyTenant } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";
import { campusOverlayFetchUrl, isHttpsOverlayUrl } from "@/lib/campus/operational-map/campus-overlay-url";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campusCode: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params;

  let overlayUrl = process.env.CAMPUS_GEOJSON_OVERLAY_URL?.trim() || "";
  if (!overlayUrl && user.agencyId) {
    const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(user.agencyId)}`);
    if (res.ok) {
      const agency = (await res.json()) as AgencyTenant;
      overlayUrl = agency.config?.campus?.geojsonOverlayUrl?.trim() || "";
    }
  }

  if (!overlayUrl) {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "private, max-age=60" } });
  }
  if (!isHttpsOverlayUrl(overlayUrl)) {
    return NextResponse.json({ error: "Overlay URL must be https" }, { status: 400 });
  }

  try {
    const fetched = await fetch(campusOverlayFetchUrl(overlayUrl), {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json, application/geo+json" },
    });
    if (!fetched.ok) {
      return NextResponse.json(EMPTY, { headers: { "Cache-Control": "private, max-age=30" } });
    }
    const json = (await fetched.json()) as GeoJSON.FeatureCollection;
    if (json?.type !== "FeatureCollection" || !Array.isArray(json.features)) {
      return NextResponse.json(EMPTY);
    }
    return NextResponse.json(json, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "private, max-age=30" } });
  }
}
