import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyQrNfc } from "@/lib/server/qr-nfc-proxy";

/**
 * Dedicated list so GET /api/qr-nfc/site-usage is not treated as qrId=site-usage.
 */
export async function GET(request: NextRequest) {
  const primary = await proxyQrNfc(request, ["site-usage"]);
  if (primary.status !== 404) return primary;
  return NextResponse.json({
    items: [
      {
        qrId: "site-home",
        destinationId: "home",
        name: "Rapid Cortex site — Home",
        url: "https://www.rapidcortex.us",
        scanCount: 0,
        nfcTapCount: 0,
        totalEngagements: 0,
      },
      {
        qrId: "site-demo",
        destinationId: "demo",
        name: "Rapid Cortex site — Demo",
        url: "https://www.rapidcortex.us/demo/",
        scanCount: 0,
        nfcTapCount: 0,
        totalEngagements: 0,
      },
    ],
  });
}
