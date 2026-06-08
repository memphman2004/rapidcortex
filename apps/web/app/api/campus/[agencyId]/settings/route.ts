import { NextResponse } from "next/server";
import type { AgencyTenant } from "rapid-cortex-shared";
import { campusAgencyConfigPatchSchema } from "rapid-cortex-shared";
import { requireCampusAdminApiAccess } from "@/lib/campus/campus-api-auth";
import {
  campusPatchFromSettingsView,
  campusSettingsFromAgency,
  type CampusSettingsView,
} from "@/lib/campus/campus-settings-mapper";
import { campusUpstreamFetch } from "@/lib/campus/campus-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const auth = await requireCampusAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Failed to load campus settings" },
      { status: res.status },
    );
  }

  const agency = (await res.json()) as AgencyTenant;
  return NextResponse.json(campusSettingsFromAgency(agency));
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const auth = await requireCampusAdminApiAccess(agencyId);
  if (!auth.ok) return auth.response;

  let body: Partial<CampusSettingsView> = {};
  try {
    body = (await request.json()) as Partial<CampusSettingsView>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patchBody = campusPatchFromSettingsView(body);
  const parsed = campusAgencyConfigPatchSchema.safeParse(patchBody.campus);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campus settings payload" }, { status: 400 });
  }

  const res = await campusUpstreamFetch(`/api/agencies/${encodeURIComponent(agencyId)}`, {
    method: "PATCH",
    body: JSON.stringify(patchBody),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { error?: string }).error ?? "Failed to save campus settings" },
      { status: res.status },
    );
  }

  const agency = (await res.json()) as AgencyTenant;
  return NextResponse.json(campusSettingsFromAgency(agency));
}
