import { VenueIncidentDetailClient } from "./venue-incident-detail-client";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ venueCode: string; incidentId: string }>;
}) {
  const { venueCode, incidentId } = await params;
  return <VenueIncidentDetailClient venueCode={venueCode} incidentId={incidentId} />;
}
