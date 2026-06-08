import { NextResponse } from "next/server";
import { ensureAgencyAccess, requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";
import { cadWritebackEnvBlockedResponse } from "@/lib/rapid-cortex/cad/cad-writeback-gate";
import { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";

const writeback = new CadWritebackService();

type Ctx = { params: Promise<{ incidentId: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const envBlocked = cadWritebackEnvBlockedResponse();
  if (envBlocked) return envBlocked;

  const auth = await requireCadApiUser();
  if (!auth.ok) return auth.response;

  const { incidentId } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const agencyError = ensureAgencyAccess(auth.user.agencyId, body.agencyId);
  if (agencyError) return NextResponse.json({ error: agencyError }, { status: 400 });
  if (typeof body.note !== "string" || !body.note.trim()) {
    return NextResponse.json({ error: "note is required." }, { status: 400 });
  }

  const queued = writeback.createWritebackRequest({
    agencyId: auth.user.agencyId,
    incidentId,
    action: "addNarrativeNote",
    requestedBy: auth.user.userId,
    requestPayload: {
      agencyId: auth.user.agencyId,
      incidentId,
      note: body.note,
      createdBy: auth.user.userId,
      createdAt: new Date().toISOString(),
    },
  });

  return NextResponse.json(
    { ok: true, queued, message: "Write-back request queued for supervisor/admin approval." },
    { status: 202 },
  );
}
