import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { buildCampusMapConfig } from "@/lib/campus/operational-map/campus-map-config";
import { resolveCampusOsmConfig } from "@/lib/campus/operational-map/campus-osm-registry";
import { resolveVenueOperationalMap } from "@/lib/venue/operational-awareness/resolve-operational-map";
import { buildVenueMapConfig } from "@/lib/venue/operational-awareness/venue-map-config";

/**
 * Venue map renderer config. Always 200 for authenticated users — missing CAD
 * data returns renderer: "svg" instead of 404 (Tier 1 fallback).
 * Known campus codes return campus OSM config so they are not retitled as MBS.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueCode: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { venueCode } = await params;
  if (resolveCampusOsmConfig(venueCode)) {
    return NextResponse.json(buildCampusMapConfig(venueCode), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }
  const map = resolveVenueOperationalMap(venueCode);
  return NextResponse.json(buildVenueMapConfig(map), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
