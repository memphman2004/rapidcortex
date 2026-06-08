import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import {
  requireHospitalPortalApiAccess,
  requireHospitalRoutingConfigEditAccess,
} from "@/lib/hospital/hospital-api-auth";
import {
  getHospitalRoutingConfig,
  patchHospitalRoutingConfig,
  type HospitalRoutingConfig,
} from "@/lib/hospital/hospital-routing-config-store";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalPortalApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  return NextResponse.json(getHospitalRoutingConfig(agencyId));
}

export async function PATCH(request: Request, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalRoutingConfigEditAccess(agencyId);
  if (!auth.ok) return auth.response;

  let body: Partial<HospitalRoutingConfig> = {};
  try {
    body = (await request.json()) as Partial<HospitalRoutingConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  return NextResponse.json(patchHospitalRoutingConfig(agencyId, body));
}
