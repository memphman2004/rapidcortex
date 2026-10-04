import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { canViewIQReporting } from "@/lib/analytics/analytics-authz";
import type { IQVertical } from "@/lib/analytics/iq-reporting-types";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

const VERTICALS = new Set<IQVertical>(["911", "campus", "venue", "transit", "hospital"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const agencyId = (url.searchParams.get("agencyId") ?? "").trim();
  const verticalRaw = (url.searchParams.get("vertical") ?? "").trim() as IQVertical;
  const startDate = (url.searchParams.get("startDate") ?? "").trim();
  const endDate = (url.searchParams.get("endDate") ?? "").trim();

  if (!agencyId || !VERTICALS.has(verticalRaw) || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  if (startDate > endDate) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  if (!canViewIQReporting(user, agencyId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return proxyToAuthUpstream(request, "/api/analytics/reporting");
}
