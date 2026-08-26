import type { NextRequest } from "next/server";
import { proxyQrNfc } from "@/lib/server/qr-nfc-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxyQrNfc(request, segments);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxyQrNfc(request, segments);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxyQrNfc(request, segments);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  return proxyQrNfc(request, segments);
}
