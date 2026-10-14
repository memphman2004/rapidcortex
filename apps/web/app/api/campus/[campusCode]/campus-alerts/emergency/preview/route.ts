import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ campusCode: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const { campusCode } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/campus/${encodeURIComponent(campusCode)}/campus-alerts/emergency/preview`,
  );
}
