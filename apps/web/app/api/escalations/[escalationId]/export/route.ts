import { NextRequest, NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { isEscalationUiEnabled } from "@/lib/runtime-flags";

type Ctx = { params: Promise<{ escalationId: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  if (!isEscalationUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { escalationId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/escalations/${encodeURIComponent(escalationId)}/export`,
  );
}
