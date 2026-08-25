import { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { isEscalationUiEnabled } from "@/lib/runtime-flags";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!isEscalationUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/escalations");
}

export async function POST(request: NextRequest) {
  if (!isEscalationUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/escalations");
}
