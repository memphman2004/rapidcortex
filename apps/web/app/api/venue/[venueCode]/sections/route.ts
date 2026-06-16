import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ venueCode: string }> },
) {
  const { venueCode } = await params;
  return proxyToAuthUpstream(request, `/api/venue/${encodeURIComponent(venueCode)}/sections`);
}
