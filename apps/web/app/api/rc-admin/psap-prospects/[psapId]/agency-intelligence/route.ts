import { NextRequest, NextResponse } from "next/server";
import { agencyIntelligenceBffGate } from "@/lib/sales/agency-intelligence-bff";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ psapId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const denied = await agencyIntelligenceBffGate();
  if (denied) return denied;
  const { psapId } = await context.params;
  if (!psapId?.trim()) return NextResponse.json({ error: "psapId is required" }, { status: 400 });
  return proxyToAuthUpstream(
    request,
    `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}/agency-intelligence`,
  );
}
