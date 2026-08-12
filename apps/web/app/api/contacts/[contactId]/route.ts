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

type Ctx = { params: Promise<{ contactId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await contactsGate();
  if (denied) return denied;
  const { contactId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/contacts/${encodeURIComponent(contactId)}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = await contactsGate();
  if (denied) return denied;
  const { contactId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/contacts/${encodeURIComponent(contactId)}`);
}
