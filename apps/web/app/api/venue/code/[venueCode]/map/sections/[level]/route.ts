import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { buildDemoVenueSectionGeoJSON } from "@/lib/venue/operational-awareness/demo-section-geojson";
import { resolveVenueOperationalMap } from "@/lib/venue/operational-awareness/resolve-operational-map";

/** Same-origin GeoJSON for Mapbox section polygons. Never 404s. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueCode: string; level: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { venueCode, level } = await params;
  const map = resolveVenueOperationalMap(venueCode);
  const levelId = level === "all" || level === "exterior" ? undefined : level;
  return NextResponse.json(buildDemoVenueSectionGeoJSON(map, levelId), {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
