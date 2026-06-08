import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AgencyTenant } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import type { UserContext } from "rapid-cortex-shared/types";
import {
  canAccessCampusUsersOrSettings,
  normalizeCampusCode,
  resolveCampusAgencyIdFromCode,
  userCampusCode,
} from "./campus-access";
import { campusSettingsFromAgency } from "./campus-settings-mapper";

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

function resolveAgencyIdForCampusPage(
  user: UserContext,
  campusCode: string,
  agencies: readonly AgencyTenant[],
): string | null {
  const userCode = userCampusCode(user);

  if (user.role.toUpperCase() === "CAMPUS_ADMIN" && userCode === campusCode && user.agencyId) {
    return user.agencyId;
  }
  if (isRcInternalOperator(user.role)) {
    return resolveCampusAgencyIdFromCode(agencies, campusCode);
  }
  if (user.agencyId) {
    return user.agencyId;
  }
  return null;
}

/** Human-readable campus name for titles/metadata (no auth redirects). */
export async function resolveCampusDisplayName(campusCodeParam: string): Promise<string> {
  const campusCode = normalizeCampusCode(campusCodeParam);
  const user = await getDashboardSessionUser();
  if (!user) return campusCode;

  const agencies = await fetchAgenciesForSession();
  const agencyId = resolveAgencyIdForCampusPage(user, campusCode, agencies);
  if (!agencyId) return campusCode;

  const agency = agencies.find((row) => row.agencyId === agencyId);
  if (!agency) return campusCode;

  const displayName = campusSettingsFromAgency(agency).general.displayName.trim();
  return displayName || agency.name?.trim() || campusCode;
}

export async function loadCampusAdminPageContext(campusCodeParam: string) {
  const campusCode = normalizeCampusCode(campusCodeParam);
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!canAccessCampusUsersOrSettings(user, campusCode)) {
    redirect(`/app/campus/${campusCode}`);
  }

  const agencies = await fetchAgenciesForSession();
  const agencyId = resolveAgencyIdForCampusPage(user, campusCode, agencies);
  const agency = agencyId ? agencies.find((row) => row.agencyId === agencyId) : undefined;
  const displayName = agency
    ? campusSettingsFromAgency(agency).general.displayName.trim() || agency.name?.trim() || campusCode
    : campusCode;

  return { campusCode, user, agencyId, displayName };
}
