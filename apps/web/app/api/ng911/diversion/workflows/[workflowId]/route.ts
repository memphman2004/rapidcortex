import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ workflowId: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { workflowId } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/ng911/diversion/workflows/${encodeURIComponent(workflowId)}`,
  );
}
