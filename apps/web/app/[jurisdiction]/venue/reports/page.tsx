import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { VenueReportsPanel } from "@/components/venue/venue-reports-panel";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueReportsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const { user, venueName, linkBase, agencyId } = await loadVenueJurisdictionContext(jurisdiction);

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
      userId={user.userId}
    >
      <VenueReportsPanel agencyId={agencyId} linkBase={linkBase} />
    </VenueOperationsShell>
  );
}
