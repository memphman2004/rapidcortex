import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import { historyEntryFromCapacity } from "@/lib/hospital/hospital-bff-mappers";
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

  const limit = Math.min(50, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
  const items = await fetchHospitalCapacityHistory(limit);
  const thresholds = getHospitalRoutingConfig(agencyId);
  return NextResponse.json({
    entries: items.map((item) => historyEntryFromCapacity(item, thresholds)),
  });
}
