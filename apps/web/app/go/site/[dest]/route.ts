import { NextResponse } from "next/server";
import { parseTradeShowDestination, tradeShowUrlFor } from "rapid-cortex-shared";
import { parseTradeShowScanMedium, recordTradeShowSiteClick } from "@/lib/qr-nfc/record-site-click";

type Ctx = { params: Promise<{ dest: string }> };

export const dynamic = "force-dynamic";

/**
 * Public tracked click-through for Rapid Cortex site QR / NFC.
 * Counts the scan or tap, then 302s to www.rapidcortex.us (Home or Demo).
 */
export async function GET(request: Request, ctx: Ctx) {
  const { dest: destParam } = await ctx.params;
  const dest = parseTradeShowDestination(destParam);
  if (!dest) {
    return NextResponse.redirect(tradeShowUrlFor("home"), 302);
  }
  const medium = parseTradeShowScanMedium(new URL(request.url).searchParams.get("medium"));
  const origin = new URL(request.url).origin;
  try {
    await recordTradeShowSiteClick(origin, dest, medium);
  } catch {
    // Never block the destination page if counting fails.
  }
  const res = NextResponse.redirect(tradeShowUrlFor(dest), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
