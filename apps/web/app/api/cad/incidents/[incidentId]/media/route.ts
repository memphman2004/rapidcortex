import { NextResponse } from "next/server";
import { ensureAgencyAccess, requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";
import { CadWritebackService } from "@/lib/rapid-cortex/cad/writeback/cad-writeback-service";

const writeback = new CadWritebackService();

type Ctx = { params: Promise<{ incidentId: string }> };

export async function POST(request: Request, ctx: Ctx) {
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
  if (typeof body.mediaUrl !== "string" || !body.mediaUrl.trim()) {
    return NextResponse.json({ error: "mediaUrl is required." }, { status: 400 });
  }

  const queued = writeback.createWritebackRequest({
    agencyId: auth.user.agencyId,
    incidentId,
    action: "attachMediaLink",
    requestedBy: auth.user.userId,
    requestPayload: {
      agencyId: auth.user.agencyId,
      incidentId,
      mediaUrl: body.mediaUrl,
      mediaType: typeof body.mediaType === "string" ? body.mediaType : "unknown",
      uploadedBy: auth.user.userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json(
    { ok: true, queued, message: "Write-back request queued for supervisor/admin approval." },
    { status: 202 },
  );
}
