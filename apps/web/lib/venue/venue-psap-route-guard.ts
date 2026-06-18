import "server-only";

import { redirect } from "next/navigation";
import { verticalFromRole } from "rapid-cortex-shared";
import {
  agencyProfileVertical,
  isVerticalAgencyProfile,
} from "@/lib/agency/profile-vertical";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

/** Redirect venue/campus agencies away from PSAP-only console routes. */
export async function blockPsapRoutesForVerticalAgency(jurisdiction: string): Promise<void> {
  const profile = await fetchAgencyProfile(jurisdiction);
  if (isVerticalAgencyProfile(profile)) {
    redirect(`/${encodeURIComponent(jurisdiction)}`);
  }

  const user = await getDashboardSessionUser();
  if (!user) return;
  const claimVertical = verticalFromRole(user.role);
  if (
    user.agencyId.trim() === jurisdiction.trim() &&
    (claimVertical === "venue" || claimVertical === "campus")
  ) {
    redirect(`/${encodeURIComponent(jurisdiction)}`);
  }
}

export async function resolveAgencyVerticalForJurisdiction(
  jurisdiction: string,
): Promise<"psap" | "campus" | "venue" | "hospital" | null> {
  const profile = await fetchAgencyProfile(jurisdiction);
  if (profile) return agencyProfileVertical(profile);

  const user = await getDashboardSessionUser();
  if (user?.agencyId.trim() === jurisdiction.trim()) {
    const v = verticalFromRole(user.role);
    if (v === "venue" || v === "campus" || v === "hospital") return v;
  }
  return null;
}
