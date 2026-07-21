import "server-only";

import { NextResponse } from "next/server";
import type { UserContext } from "rapid-cortex-shared/types";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { isRcsEnabled } from "@/lib/runtime-flags";

export type RcsAccessResult = { user: UserContext } | { error: NextResponse };

/** Auth + feature-flag gate shared by every `/api/rcs/*` BFF route. RBAC (agencyId scope,
 * dispatcher vs. supervisor override) is enforced per-route via `rcs-authz.ts` afterward. */
export async function requireRcsUser(): Promise<RcsAccessResult> {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isRcsEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Response Continuity System is disabled for this deployment" },
        { status: 503 },
      ),
    };
  }
  return { user };
}

export function rcsForbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
