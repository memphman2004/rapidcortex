import { NextRequest, NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { isRmsUiEnabled } from "@/lib/runtime-flags";

type Ctx = { params: Promise<{ reportId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  if (!isRmsUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { reportId } = await ctx.params;
  return proxyToAuthUpstream(request, `/api/rms/reports/${encodeURIComponent(reportId)}/push`);
}
