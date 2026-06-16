import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CampusSafetyDashboardPage } from "@/components/campus/campus-safety-dashboard-page";
import { VenueOperationsDashboardPage } from "@/components/venue/venue-operations-dashboard-page";
import { fetchAgencyProfile } from "@/lib/agency/agency-profile";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { isReservedPublicJurisdictionSlug } from "@/lib/reserved-public-route-segments";

type Props = { params: Promise<{ jurisdiction: string }> };

/**
 * Agency home at `/{agencySlug}` — routes by DynamoDB agency type, not JWT claims.
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
  if (!profile) {
    redirect(`/${jurisdiction}/dashboard`);
  }

  switch (profile.agencyType) {
    case "campus":
      return <CampusSafetyDashboardPage />;
    case "venue":
      return <VenueOperationsDashboardPage />;
    default:
      redirect(`/${jurisdiction}/dashboard`);
  }
}
