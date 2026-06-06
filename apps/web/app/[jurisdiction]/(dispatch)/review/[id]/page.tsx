import { ReviewIncidentDetail } from "@/components/dispatch/review-incident-detail";

export default async function ReviewIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewIncidentDetail incidentId={decodeURIComponent(id)} />;
}
