import { NextResponse } from "next/server";
import { ensureAgencyAccess, requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";
import { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";
import type { CadWriteAction } from "@/lib/rapid-cortex/cad/types";

const writeback = new CadWritebackService();

function isCadWriteAction(value: unknown): value is CadWriteAction {
  return (
    value === "addNarrativeNote" ||
    value === "attachMediaLink" ||
    value === "updateDisposition" ||
    value === "dispatchUnit" ||
    value === "changePriority" ||
    value === "closeIncident" ||
    value === "deleteIncident"
  );
}

export async function POST(request: Request) {
  const auth = await requireCadApiUser({ mustApprove: true });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const agencyError = ensureAgencyAccess(auth.user.agencyId, body.agencyId);
  if (agencyError) return NextResponse.json({ error: agencyError }, { status: 400 });
  if (typeof body.incidentId !== "string" || !body.incidentId.trim()) {
    return NextResponse.json({ error: "incidentId is required." }, { status: 400 });
  }
  if (typeof body.requestedBy !== "string" || !body.requestedBy.trim()) {
    return NextResponse.json({ error: "requestedBy is required." }, { status: 400 });
  }
  if (!isCadWriteAction(body.action)) {
    return NextResponse.json({ error: "action is invalid." }, { status: 400 });
  }
  if (!body.requestPayload || typeof body.requestPayload !== "object") {
    return NextResponse.json({ error: "requestPayload is required." }, { status: 400 });
  }

  const result = await writeback.executeWriteback({
    agencyId: auth.user.agencyId,
    incidentId: body.incidentId,
    action: body.action,
    approvalStatus: "approved",
    approvedBy: auth.user.userId,
    requestedBy: body.requestedBy,
    requestPayload: body.requestPayload as Record<string, unknown>,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
