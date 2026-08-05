import { VenueNotificationsPanel } from "@/components/venue/venue-notifications-panel";
import { VenueOperationsShell } from "@/components/venue/venue-operations-shell";
import { loadVenueJurisdictionContext } from "@/lib/venue/venue-jurisdiction-context";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function VenueNotificationsPage({ params }: Props) {
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
      <VenueNotificationsPanel agencyId={agencyId} userRole={user.role} />
    </VenueOperationsShell>
  );
}
