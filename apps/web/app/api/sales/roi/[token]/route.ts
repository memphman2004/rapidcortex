import { NextRequest, NextResponse } from "next/server";
import { getRoiSession } from "@/lib/sales/sales-store";

/** PUBLIC — no auth. Savings data only. */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const session = await getRoiSession(token);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ttl = Number(session.ttl ?? 0);
  if (ttl && ttl < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "Link expired" }, { status: 404 });
  }
  return NextResponse.json({
    roiToken: session.roiToken,
    inputs: session.inputs,
    createdAt: session.createdAt,
  });
}
