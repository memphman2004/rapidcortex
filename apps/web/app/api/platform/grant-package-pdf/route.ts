import { NextRequest, NextResponse } from "next/server";
import { isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { grantPackageSchema } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isGrantSuccessProgramUiEnabled } from "@/lib/runtime-flags";
import { generateGrantPackagePdfBuffer } from "@/lib/server/grant-package-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/platform/grant-package-pdf
 * Builds a downloadable PDF from an already-generated grant package (rcadmin+).
 */
export async function POST(request: NextRequest) {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    (!isRcSuperAdmin(user.role) && !isRcAdmin(user.role)) ||
    !isGrantSuccessProgramUiEnabled()
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return NextResponse.json({ error: "Invalid grant package payload" }, { status: 400 });
  }

  const body = json as Record<string, unknown>;
  const profileRaw = body.profile;
  if (!profileRaw || typeof profileRaw !== "object" || Array.isArray(profileRaw)) {
    return NextResponse.json({ error: "Missing profile" }, { status: 400 });
  }
  const profile = profileRaw as Record<string, unknown>;
  const schoolName = typeof profile.schoolName === "string" ? profile.schoolName.trim() : "";
  const city = typeof profile.city === "string" ? profile.city.trim() : "";
  const state = typeof profile.state === "string" ? profile.state.trim() : "";
  if (!schoolName || !city || !state) {
    return NextResponse.json({ error: "Profile requires schoolName, city, and state" }, { status: 400 });
  }

  const parsedPkg = grantPackageSchema.safeParse(body.grantPackage);
  if (!parsedPkg.success) {
    return NextResponse.json({ error: "Invalid grant package payload" }, { status: 400 });
  }

  try {
    const pdf = await generateGrantPackagePdfBuffer({
      profile: {
        schoolName,
        city,
        state,
        grantAmount: typeof profile.grantAmount === "string" ? profile.grantAmount : undefined,
        projectPeriod: typeof profile.projectPeriod === "string" ? profile.projectPeriod : undefined,
      },
      grantPackage: parsedPkg.data,
    });
    const safeName = schoolName
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const filename = `RC-Grant-Package-${safeName || "draft"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[grant-package-pdf]", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to generate grant PDF" }, { status: 500 });
  }
}
