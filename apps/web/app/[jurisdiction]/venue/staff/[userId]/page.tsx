import { VenueStaffDetailClient } from "@/components/venue/venue-staff-detail-client";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string; userId: string }> };

export default async function VenueStaffDetailPage({ params }: Props) {
  const { jurisdiction, userId } = await params;
  const { user, venueName, linkBase, agencyId, venueCode } =
    await loadVenueJurisdictionContext(jurisdiction);

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
    >
      <VenueStaffDetailClient
        agencyId={agencyId}
        userId={userId}
        linkBase={linkBase}
        venueCode={venueCode}
      />
    </VenueOperationsShell>
  );
}
