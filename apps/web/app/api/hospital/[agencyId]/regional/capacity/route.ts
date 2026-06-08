import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import { regionalFacilityFromCapacity } from "@/lib/hospital/hospital-bff-mappers";
import { requireHospitalPortalApiAccess } from "@/lib/hospital/hospital-api-auth";
import { getHospitalRoutingConfig } from "@/lib/hospital/hospital-routing-config-store";
import { fetchRegionalHospitalCapacity } from "@/lib/hospital/hospital-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalPortalApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const items = await fetchRegionalHospitalCapacity();
  const thresholds = getHospitalRoutingConfig(agencyId);
  const facilities = items.map((item) => regionalFacilityFromCapacity(item, item.hospitalId, thresholds));

  return NextResponse.json({ facilities });
}
