import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ agencyId: string; cameraId: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { agencyId, cameraId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/cameras/registry/${encodeURIComponent(cameraId)}`,
    { method: "PUT" },
  );
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { agencyId, cameraId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(agencyId)}/cameras/registry/${encodeURIComponent(cameraId)}`,
    { method: "DELETE" },
  );
}
