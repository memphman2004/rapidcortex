import { VenueSectionDetailClient } from "@/components/venue/venue-section-detail-client";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string; sectionId: string }> };

export default async function VenueSectionDetailPage({ params }: Props) {
  const { jurisdiction, sectionId } = await params;
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
      <VenueSectionDetailClient
        agencyId={agencyId}
        sectionId={sectionId}
        linkBase={linkBase}
        venueCode={venueCode}
      />
    </VenueOperationsShell>
  );
}
