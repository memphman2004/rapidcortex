import { NextResponse } from "next/server";
import { isHospitalPortalEnabled } from "@/lib/runtime-flags";
import {
  capacityRecordFromPortal,
  capacityUpdateToManualBody,
} from "@/lib/hospital/hospital-bff-mappers";
import { requireHospitalCapacityUpdateAccess } from "@/lib/hospital/hospital-api-auth";
import { getHospitalRoutingConfig } from "@/lib/hospital/hospital-routing-config-store";
import {
  fetchHospitalPortalContext,
  postHospitalCapacityUpdate,
} from "@/lib/hospital/hospital-upstream";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  if (!isHospitalPortalEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agencyId } = await ctx.params;
  const auth = await requireHospitalCapacityUpdateAccess(agencyId);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const context = await fetchHospitalPortalContext();
  if (!context) {
    return NextResponse.json({ error: "Failed to load facility context" }, { status: 502 });
  }

  const bedsTotal = context.capacity?.availability.erBeds.total ?? 0;
  const manualBody = capacityUpdateToManualBody(
    {
      bedsAvailable: Number(body.bedsAvailable ?? 0),
      diversionStatus: (body.diversionStatus as "OPEN" | "ALERT" | "DIVERSION") ?? "OPEN",
      traumaCapacity: (body.traumaCapacity as "OPEN" | "LIMITED" | "CLOSED") ?? "OPEN",
      specialtyStatus: body.specialtyStatus as {
        icu: "OPEN" | "FULL";
        pediatric: "OPEN" | "FULL";
        burn: "OPEN" | "FULL" | "NA";
      } | undefined,
      notes: String(body.notes ?? ""),
    },
    context.capacity,
    bedsTotal,
  );

  const updated = await postHospitalCapacityUpdate(manualBody);
  if (!updated) {
    return NextResponse.json({ error: "Capacity update failed" }, { status: 502 });
  }

  const thresholds = getHospitalRoutingConfig(agencyId);
  const nextContext = {
    ...context,
    capacity: updated,
  };
  return NextResponse.json(capacityRecordFromPortal(nextContext, thresholds));
}
