import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { segments } = await ctx.params;
  const tail = segments?.length ? `/${segments.join("/")}` : "";
  return proxyToAuthUpstream(request, `/api/admin/nfc-cards${tail}`);
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
