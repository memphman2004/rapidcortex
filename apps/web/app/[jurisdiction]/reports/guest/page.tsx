import { VenueGuestReportsPanel } from "@/components/venue/venue-guest-reports-panel";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueGuestReportsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const { user, venueName, linkBase, agencyId } = await loadVenueJurisdictionContext(jurisdiction);

  return (
    <VenueOperationsShell
      agencyId={agencyId}
      venueName={venueName}
      linkBase={linkBase}
      userEmail={user.email ?? ""}
      userRole={user.role}
    >
      <VenueGuestReportsPanel agencyId={agencyId} linkBase={linkBase} />
    </VenueOperationsShell>
  );
}
