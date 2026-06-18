import { NextResponse } from "next/server";
import type { UserContext } from "rapid-cortex-shared/types";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";
import {
  canAccessCampusOnboarding,
  canAccessVenueOnboarding,
} from "@/lib/onboarding/onboarding-access";

type Ok = { ok: true; user: UserContext };
type Fail = { ok: false; response: NextResponse };

export async function requireCampusOnboardingApi(
  orgCode: string,
): Promise<Ok | Fail> {
  const user = await requireApiUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessCampusOnboarding(user, orgCode)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function requireVenueOnboardingApi(orgCode: string): Promise<Ok | Fail> {
  const user = await requireApiUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canAccessVenueOnboarding(user, orgCode)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}

export function upstreamQuery(request: Request, agencyId?: string): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("agencyId")?.trim();
  const resolved = fromQuery || agencyId?.trim();
  return resolved ? `?agencyId=${encodeURIComponent(resolved)}` : "";
}
