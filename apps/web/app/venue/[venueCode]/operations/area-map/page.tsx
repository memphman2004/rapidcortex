import type { Metadata } from "next";
import { OperationalMapPopoutClient } from "@/components/venue/operational-awareness/OperationalMapPopoutClient";
import { extractVenueCode } from "@/lib/auth/post-login-redirect";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { resolveVenueDisplayName } from "@/lib/venue/venue-tenant";

type Params = { venueCode: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { venueCode } = await params;
  return { title: `${venueCode} Area Map | Rapid Cortex Venue` };
}

export default async function VenueAreaMapPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ incident?: string }>;
}) {
  const { venueCode } = await params;
  const query = await searchParams;
  const user = await getDashboardSessionUser();
  if (!user) return null;

  const code = extractVenueCode(user.agencyId) || venueCode.toUpperCase();
  const venueName = await resolveVenueDisplayName(code);

  return (
    <OperationalMapPopoutClient
      kind="area"
      venueCode={code}
      venueName={venueName}
      agencyId={user.agencyId}
      userId={user.userId}
      initialIncidentId={query.incident ?? null}
    />
  );
}
