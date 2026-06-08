import { NextResponse } from "next/server";
import type { UserContext } from "rapid-cortex-shared/types";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import { canAccessCampusAdminRoutes } from "./campus-access";

type CampusApiAuthOk = { ok: true; user: UserContext };
type CampusApiAuthFail = { ok: false; response: NextResponse };

export async function requireCampusAdminApiAccess(
  agencyId: string,
): Promise<CampusApiAuthOk | CampusApiAuthFail> {
  const user = await requireApiUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canAccessCampusAdminRoutes(user, agencyId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
