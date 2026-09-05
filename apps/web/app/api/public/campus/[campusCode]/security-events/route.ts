import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ campusCode: string }> },
) {
  const { campusCode } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/public/campus/${encodeURIComponent(campusCode)}/security-events`,
    { allowAnonymous: true },
  );
}
