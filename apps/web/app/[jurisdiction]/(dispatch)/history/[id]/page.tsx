import { HistoryDetail } from "@/components/dispatch/history-detail";

export default async function HistoryIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HistoryDetail incidentId={decodeURIComponent(id)} />;
}
