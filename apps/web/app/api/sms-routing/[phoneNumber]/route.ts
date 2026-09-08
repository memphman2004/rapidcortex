import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ phoneNumber: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { phoneNumber } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/sms-routing/${encodeURIComponent(phoneNumber)}`,
  );
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { phoneNumber } = await ctx.params;
  return proxyToAuthUpstream(
    request,
    `/api/sms-routing/${encodeURIComponent(phoneNumber)}`,
  );
}
