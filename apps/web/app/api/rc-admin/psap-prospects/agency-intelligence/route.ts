import { NextRequest, NextResponse } from "next/server";
import { agencyIntelligenceBffGate } from "@/lib/sales/agency-intelligence-bff";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(request: NextRequest) {
  const denied = await agencyIntelligenceBffGate();
  if (denied) return denied;
  return proxyToAuthUpstream(request, "/api/rc-admin/psap-prospects/agency-intelligence");
}
