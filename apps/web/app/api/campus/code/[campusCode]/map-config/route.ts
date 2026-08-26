import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { buildCampusMapConfig } from "@/lib/campus/operational-map/campus-map-config";

/** Always 200 for authenticated users — missing OSM coverage is mapbox2d, never 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campusCode: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campusCode } = await params;
  return NextResponse.json(buildCampusMapConfig(campusCode), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
