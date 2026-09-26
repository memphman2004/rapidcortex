import "server-only";

import { NextResponse } from "next/server";
import type { UserContext } from "rapid-cortex-shared/types";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { isLoadoutPortalEnabled } from "@/lib/runtime-flags";

export type LoadoutAccessResult = { user: UserContext } | { error: NextResponse };

/**
 * Auth + feature-flag gate shared by every `/api/loadout/*` BFF route.
 * Role-level access (agencyadmin / rcsuperadmin / rcadmin) is enforced per-route afterward.
 */
export async function requireLoadoutUser(): Promise<LoadoutAccessResult> {
  const user = await requireApiUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isLoadoutPortalEnabled()) {
    return {
      error: NextResponse.json(
        { error: "Loadout Portal is disabled for this deployment" },
        { status: 503 },
      ),
    };
  }
  const role = user.role ?? "";
  if (
    role !== "rcsuperadmin" &&
    role !== "rcadmin" &&
    role !== "agencyadmin"
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export function loadoutForbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
