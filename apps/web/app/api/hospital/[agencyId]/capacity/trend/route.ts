import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import { trendPointFromCapacity } from "@/lib/hospital/hospital-bff-mappers";
import { requireHospitalPortalApiAccess } from "@/lib/hospital/hospital-api-auth";
import { getHospitalRoutingConfig } from "@/lib/hospital/hospital-routing-config-store";
import { fetchHospitalCapacityHistory } from "@/lib/hospital/hospital-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalPortalApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const days = Math.min(30, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("days") ?? "7", 10) || 7));
  const items = await fetchHospitalCapacityHistory(days * 4);
  const thresholds = getHospitalRoutingConfig(agencyId);
  const points = items
    .slice(0, days)
    .reverse()
    .map((item) => trendPointFromCapacity(item, thresholds));

  return NextResponse.json({ points });
}
