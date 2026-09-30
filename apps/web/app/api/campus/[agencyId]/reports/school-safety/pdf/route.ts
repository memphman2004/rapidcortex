import { NextResponse } from "next/server";
import { schoolSafetyReportPdfBodySchema } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCampusAssignableRole } from "@/lib/campus/campus-access";
import { generateSchoolSafetyReportPdfBuffer } from "@/lib/server/campus-school-safety-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ agencyId: string }> };

/**
 * POST /api/campus/[agencyId]/reports/school-safety/pdf
 * Builds a School Safety period PDF from platform counts + optional operator notes.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { agencyId } = await ctx.params;
  const user = await getDashboardSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (user.role ?? "").trim();
  const allowed =
    isRcInternalOperator(role) ||
    (user.agencyId === agencyId && isCampusAssignableRole(role));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schoolSafetyReportPdfBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid report payload" },
      { status: 400 },
    );
  }

  try {
    const pdf = await generateSchoolSafetyReportPdfBuffer(parsed.data);
    const safeSchool = parsed.data.schoolName
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const filename = `school-safety-${safeSchool || agencyId}-${parsed.data.from}_${parsed.data.to}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[school-safety-pdf]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to generate school safety PDF" }, { status: 500 });
  }
}
