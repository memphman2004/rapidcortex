import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { hasSubscriberManualAccess } from "@/lib/auth/subscriber-access";
import { verifyCognitoIdToken } from "@/lib/auth/verify-cognito";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { userMayAccessDashboardPrefix } from "@/lib/dashboards/dashboard-access";
import { getDashboardSummaryForUser } from "@/lib/dashboards/get-dashboard-summary";
import { assertDashboardAgencyScope } from "@/lib/dashboards/validate-dashboard-data-scope";

const PREFIXES: readonly DashboardPrefix[] = [
  "rc-admin",
  "agency-admin",
  "dispatcher",
  "supervisor",
  "qa",
  "it-security",
  "executive",
];

function isDashboardPrefix(v: string | null): v is DashboardPrefix {
  return v != null && (PREFIXES as readonly string[]).includes(v);
}

/**
 * GET /api/dashboard/summary?prefix=agency-admin&agencyId=...
 * TODO: Swap mock payload for DynamoDB + Lambda; keep assertDashboardAgencyScope on every query.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const prefixRaw = url.searchParams.get("prefix");
  const agencyIdParam = url.searchParams.get("agencyId");

  if (!isDashboardPrefix(prefixRaw)) {
    return NextResponse.json({ error: "Invalid or missing prefix" }, { status: 400 });
  }
  const prefix = prefixRaw;

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  const user = token ? await verifyCognitoIdToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSubscriberManualAccess(user)) {
    return NextResponse.json({ error: "Subscriber required" }, { status: 403 });
  }
  if (!userMayAccessDashboardPrefix(user, prefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    assertDashboardAgencyScope(user, agencyIdParam);
  } catch {
    return NextResponse.json({ error: "Agency scope denied" }, { status: 403 });
  }

  const payload = getDashboardSummaryForUser(prefix, user);
  return NextResponse.json(payload);
}
