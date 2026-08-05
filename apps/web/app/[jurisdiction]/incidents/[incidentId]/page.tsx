import { VenueIncidentOpsDetailClient } from "@/components/venue/venue-incident-ops-detail-client";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string; incidentId: string }> };

export default async function VenueJurisdictionIncidentPage({ params }: Props) {
  const { jurisdiction, incidentId } = await params;
  const { user, venueName, linkBase, agencyId, venueCode } =
    await loadVenueJurisdictionContext(jurisdiction);

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    >
      <VenueIncidentOpsDetailClient
        agencyId={agencyId}
        venueCode={venueCode}
        incidentId={incidentId}
        linkBase={linkBase}
        userRole={user.role}
      />
    </VenueOperationsShell>
  );
}
