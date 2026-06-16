import { cookies } from "next/headers";
import type { AgencyTenant } from "rapid-cortex-shared";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { resolveAgencyVerticalFromTenant } from "@/lib/vertical";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";

async function fetchAgenciesForSession(): Promise<AgencyTenant[]> {
  const base = process.env.API_UPSTREAM_BASE?.trim().replace(/\/$/, "");
  if (!base) return [];

  const jar = await cookies();
  const token = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!token) return [];

  try {
    const res = await fetch(`${base}/api/agencies`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: AgencyTenant[]; data?: { items?: AgencyTenant[] } };
    return json.items ?? json.data?.items ?? [];
  } catch {
    return [];
  }
}

/** Human-readable venue name for console chrome (falls back to org code). */
export async function resolveVenueDisplayName(venueCodeParam: string): Promise<string> {
  const venueCode = venueCodeParam.trim().toUpperCase().replace(/-/g, "");
  const user = await getDashboardSessionUser();
  if (!user) return venueCode;

  const agencies = await fetchAgenciesForSession();
  const agency =
    agencies.find((row) => row.agencyId === user.agencyId) ??
    agencies.find((row) => {
      const vertical = resolveAgencyVerticalFromTenant(row);
      if (vertical !== "venue" && row.type !== "venue") return false;
      return extractVenueCode(row.agencyId) === venueCode;
    });

  if (!agency) return venueCode;
  return agency.name?.trim() || venueCode;
}
