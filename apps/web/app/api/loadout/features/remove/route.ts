import { type NextRequest } from "next/server";
import { requireLoadoutUser } from "@/lib/loadout/loadout-server-access";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

/** POST /api/loadout/features/remove — remove a feature from the tenant subscription. */
export async function POST(request: NextRequest) {
  const result = await requireLoadoutUser();
  if ("error" in result) return result.error;
  return proxyToAuthUpstream(request, "/api/loadout/features/remove");
}
