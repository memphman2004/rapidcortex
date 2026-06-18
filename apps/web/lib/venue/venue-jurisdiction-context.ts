import "server-only";

import { redirect } from "next/navigation";
import { verticalFromRole } from "rapid-cortex-shared";
import { agencyProfileVertical, isVerticalAgencyProfile } from "@/lib/agency/profile-vertical";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isVerticalEnabled } from "@/lib/features";
import { resolveVenueDisplayName } from "@/lib/venue/venue-tenant";

export async function loadVenueJurisdictionContext(jurisdiction: string) {
  if (!isVerticalEnabled("venue") && !isVerticalEnabled("campus")) {
    redirect("/unauthorized");
  }

  const user = await getDashboardSessionUser();
  if (!user) redirect(`/login?from=/${encodeURIComponent(jurisdiction)}`);

  const profile = await fetchAgencyProfile(jurisdiction);
  if (profile && !isVerticalAgencyProfile(profile)) {
    redirect(`/${encodeURIComponent(jurisdiction)}/dashboard`);
  }
  if (!profile) {
    const claimVertical = verticalFromRole(user.role);
    if (
      user.agencyId.trim() !== jurisdiction.trim() ||
      (claimVertical !== "venue" && claimVertical !== "campus")
    ) {
      redirect(`/${encodeURIComponent(jurisdiction)}/dashboard`);
    }
  } else {
    const vertical = agencyProfileVertical(profile);
    if (vertical !== "venue" && vertical !== "campus") {
      redirect(`/${encodeURIComponent(jurisdiction)}`);
    }
  }

  const venueCode = extractVenueCode(jurisdiction);
  const venueName = profile?.name ?? (await resolveVenueDisplayName(venueCode));

  return {
    user,
    agencyId: jurisdiction,
    venueCode,
    venueName,
    linkBase: `/${jurisdiction}`,
  };
}
