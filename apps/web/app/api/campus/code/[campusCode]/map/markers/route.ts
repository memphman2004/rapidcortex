import { NextResponse } from "next/server";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { resolveCampusOsmConfig } from "@/lib/campus/operational-map/campus-osm-registry";
import { loadCampusOsmMapData } from "@/lib/campus/operational-map/load-campus-osm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campusCode: string }> },
) {
  const user = await getDashboardSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campusCode } = await params;
  const osm = resolveCampusOsmConfig(campusCode);
  if (!osm) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, max-age=60" } });
  }
  const data = await loadCampusOsmMapData(osm);
  return NextResponse.json(
    { items: data.markers },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
