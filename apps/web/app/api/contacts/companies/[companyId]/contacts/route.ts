import { NextRequest, NextResponse } from "next/server";
import { canAccessContactsModule } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isContactsModuleUiEnabled } from "@/lib/runtime-flags";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

async function contactsGate(): Promise<NextResponse | null> {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessContactsModule(user.role) || !isContactsModuleUiEnabled()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

type Ctx = { params: Promise<{ companyId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const denied = await contactsGate();
  if (denied) return denied;
  const { companyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/contacts/companies/${encodeURIComponent(companyId)}/contacts`,
  );
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const denied = await contactsGate();
  if (denied) return denied;
  const { companyId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/contacts/companies/${encodeURIComponent(companyId)}/contacts`,
  );
}
