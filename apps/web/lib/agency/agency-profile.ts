import "server-only";

import { cookies } from "next/headers";
import type { AgencyProfileResponse } from "rapid-cortex-shared";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";

function upstreamBase(): string | null {
  const base = process.env.API_UPSTREAM_BASE?.trim().replace(/\/$/, "");
  return base || null;
}

/** Fetch slim agency profile for dashboard routing (agency type from DynamoDB, not JWT). */
export async function fetchAgencyProfile(
  agencyId: string,
): Promise<AgencyProfileResponse | null> {
  const base = upstreamBase();
  if (!base) return null;

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${base}/api/agencies/${encodeURIComponent(agencyId)}/profile`, {
      headers: { authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AgencyProfileResponse | { data?: AgencyProfileResponse };
    if (json && typeof json === "object" && "agencyType" in json) {
      return json as AgencyProfileResponse;
    }
    return (json as { data?: AgencyProfileResponse }).data ?? null;
  } catch {
    return null;
  }
}
