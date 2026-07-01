import { VenueGuestReportsPanel } from "@/components/venue/venue-guest-reports-panel";
import { VenueGuestServicesPageFrame } from "@/components/venue/venue-guest-services-page-frame";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueGuestReportsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const { user, venueName, agencyId } = await loadVenueJurisdictionContext(jurisdiction);

  return (
    <VenueGuestServicesPageFrame
      agencyId={agencyId}
      venueName={venueName}
      userEmail={user.email ?? ""}
      userRole={user.role}
    >
      <VenueGuestReportsPanel agencyId={agencyId} />
    </VenueGuestServicesPageFrame>
  );
}
