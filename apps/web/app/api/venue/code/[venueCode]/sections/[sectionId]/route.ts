import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ venueCode: string; sectionId: string }> },
) {
  const { venueCode, sectionId } = await params;
  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(venueCode)}/sections/${encodeURIComponent(sectionId)}`,
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ venueCode: string; sectionId: string }> },
) {
  const { venueCode, sectionId } = await params;
  return proxyToAuthUpstream(
    request,
    `/api/venue/${encodeURIComponent(venueCode)}/sections/${encodeURIComponent(sectionId)}`,
  );
}
