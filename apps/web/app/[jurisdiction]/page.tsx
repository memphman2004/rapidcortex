import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verticalFromRole } from "rapid-cortex-shared";
import { CampusSafetyDashboardPage } from "@/components/campus/campus-safety-dashboard-page";
import { VenueOperationsDashboardPage } from "@/components/venue/venue-operations-dashboard-page";
import { agencyProfileVertical } from "@/lib/agency/profile-vertical";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isReservedPublicJurisdictionSlug } from "@/lib/reserved-public-route-segments";

type Props = { params: Promise<{ jurisdiction: string }> };

/**
 * Agency home at `/{agencySlug}` — routes by DynamoDB agency type, not JWT claims alone.
 * PSAP agencies keep the legacy dispatcher workspace at `/{slug}/dashboard`.
 */
export default async function JurisdictionRootPage({ params }: Props) {
  const { jurisdiction } = await params;
  if (isReservedPublicJurisdictionSlug(jurisdiction)) {
    notFound();
  }

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  if (!idToken) {
    redirect(`/login?from=/${encodeURIComponent(jurisdiction)}`);
  }

  const profile = await fetchAgencyProfile(jurisdiction);

  if (process.env.NODE_ENV === "development" || jurisdiction === "test-venue-mbs") {
    console.log("[jurisdiction-route]", jurisdiction, "profile", profile);
  }

  if (profile) {
    const vertical = agencyProfileVertical(profile);
    if (process.env.NODE_ENV === "development") {
      console.log("[jurisdiction-route]", jurisdiction, "vertical", vertical);
    }
    if (vertical === "venue") {
      return <VenueOperationsDashboardPage agencyId={jurisdiction} profile={profile} />;
    }
    if (vertical === "campus") {
      return <CampusSafetyDashboardPage agencyId={jurisdiction} profile={profile} />;
    }
    redirect(`/${jurisdiction}/dashboard`);
  }

  const user = await getDashboardSessionUser();
  const claimVertical = user ? verticalFromRole(user.role) : null;
  if (user && user.agencyId.trim() === jurisdiction.trim()) {
    if (claimVertical === "venue") {
      return <VenueOperationsDashboardPage agencyId={jurisdiction} profile={null} />;
    }
    if (claimVertical === "campus") {
      return <CampusSafetyDashboardPage agencyId={jurisdiction} profile={null} />;
    }
  }

  redirect(`/${jurisdiction}/dashboard`);
}
