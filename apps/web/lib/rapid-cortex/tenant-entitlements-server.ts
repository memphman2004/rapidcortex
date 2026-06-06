import "server-only";

import { cookies } from "next/headers";
import type { TenantEntitlements, UserContext } from "rapid-cortex-shared";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";

type EntitlementsPayload = {
  data?: {
    entitlements?: TenantEntitlements;
  };
};

/** Load billing entitlements for the signed-in agency (stack-1 upstream). */
export async function fetchTenantEntitlementsForUser(
  user: UserContext,
): Promise<TenantEntitlements | null> {
  if (!user.agencyId) return null;
  const base = process.env.API_UPSTREAM_BASE?.trim().replace(/\/$/, "");
  if (!base) return null;

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${base}/api/agency/entitlements`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EntitlementsPayload;
    return json.data?.entitlements ?? null;
  } catch {
    return null;
  }
}
