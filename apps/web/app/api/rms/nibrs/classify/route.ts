import { NextRequest, NextResponse } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";
import { isRmsUiEnabled } from "@/lib/runtime-flags";

export async function POST(request: NextRequest) {
  if (!isRmsUiEnabled()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return proxyToAuthUpstream(request, "/api/rms/nibrs/classify");
}
