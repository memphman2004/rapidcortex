import { NextRequest, NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { isEscalationUiEnabled } from "@/lib/runtime-flags";

export async function POST(request: NextRequest) {
  if (!isEscalationUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/venue/push-subscription");
}

export async function DELETE(request: NextRequest) {
  if (!isEscalationUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/venue/push-subscription");
}
