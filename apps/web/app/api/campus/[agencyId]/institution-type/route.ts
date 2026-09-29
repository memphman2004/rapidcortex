import { NextResponse } from "next/server";
import type { AgencyTenant } from "rapid-cortex-shared";
import { isRcInternalOperator, resolveCampusInstitutionType } from "rapid-cortex-shared";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

/** Campus seats in-tenant (or RC internal) may read institutionType for nav/dashboard branching. */
export async function GET(_request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRcInternalOperator(user.role) && user.agencyId !== agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}`);
  if (!res.ok) {
    return NextResponse.json({ institutionType: "higher_ed" as const });
  }
  const agency = (await res.json()) as AgencyTenant;
  const institutionType = resolveCampusInstitutionType({
    institutionType: agency.institutionType ?? agency.config?.campus?.institutionType,
    campusType: agency.config?.campus?.campusType,
  });
  return NextResponse.json({
    institutionType,
    agencyId: agency.agencyId,
    name: agency.name,
  });
}
