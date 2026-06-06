import type { NextRequest } from "next/server";
import type { HttpMethod } from "rapid-cortex-shared";
import { handleRcLiteV1Request } from "@/lib/rc-lite/v1-handle";

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handleRcLiteV1Request(request, path ?? [], "GET");
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handleRcLiteV1Request(request, path ?? [], "POST");
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handleRcLiteV1Request(request, path ?? [], "DELETE");
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handleRcLiteV1Request(request, path ?? [], "PUT");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  return handleRcLiteV1Request(request, path ?? [], "PATCH");
}
