import { NextResponse } from "next/server";
import { ensureAgencyAccess, requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";
import { cadWritebackEnvBlockedResponse } from "@/lib/rapid-cortex/cad/cad-writeback-gate";
import { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";
import type { CadWriteAction } from "@/lib/rapid-cortex/cad/types";

const writeback = new CadWritebackService();

const ALLOWED_REQUEST_ACTIONS: CadWriteAction[] = [
  "addNarrativeNote",
  "attachMediaLink",
  "updateDisposition",
];

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
  const envBlocked = cadWritebackEnvBlockedResponse();
  if (envBlocked) return envBlocked;

  const auth = await requireCadApiUser();
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
  if (!isCadWriteAction(body.action)) {
    return NextResponse.json({ error: "action is invalid." }, { status: 400 });
  }
  if (!ALLOWED_REQUEST_ACTIONS.includes(body.action)) {
    return NextResponse.json(
      { error: `Action '${body.action}' is blocked by default safety policy.` },
      { status: 403 },
    );
  }
  if (!body.requestPayload || typeof body.requestPayload !== "object") {
    return NextResponse.json({ error: "requestPayload is required." }, { status: 400 });
  }

  const queued = writeback.createWritebackRequest({
    agencyId: auth.user.agencyId,
    incidentId: body.incidentId,
    action: body.action,
    requestedBy: auth.user.userId,
    requestPayload: body.requestPayload as Record<string, unknown>,
  });

  return NextResponse.json({
    ok: true,
    queued,
    message: "CAD write-back request created and pending approval.",
  });
}
