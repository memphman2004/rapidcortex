import { NextResponse } from "next/server";
import type { AgencyTenant } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { campusSettingsFromAgency } from "@/lib/campus/campus-settings-mapper";
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
    // Fail closed to higher_ed only when the agency cannot be loaded.
    return NextResponse.json({
      institutionType: "higher_ed" as const,
      agencyId,
      error: "agency_unavailable",
    });
  }

  const raw = (await res.json()) as AgencyTenant & { data?: AgencyTenant };
  const agency = (raw.data ?? raw) as AgencyTenant;
  const settings = campusSettingsFromAgency(agency);
  return NextResponse.json({
    institutionType: settings.general.institutionType,
    agencyId: agency.agencyId ?? agencyId,
    name: agency.name,
  });
}
