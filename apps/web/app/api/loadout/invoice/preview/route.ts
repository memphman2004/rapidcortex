import { type NextRequest } from "next/server";
import { requireLoadoutUser } from "@/lib/loadout/loadout-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** GET /api/loadout/invoice/preview — preview the current period invoice. */
export async function GET(request: NextRequest) {
  const result = await requireLoadoutUser();
  if ("error" in result) return result.error;
  return proxyToAuthUpstream(request, "/api/loadout/invoice/preview");
}
