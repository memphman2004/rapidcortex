import type { NextRequest } from "next/server";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Ctx) {
  const { path } = await context.params;
  const tail = (path ?? []).map(encodeURIComponent).join("/");
  return proxyToAuthUpstream(request, `/api/vault/${tail}`);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
