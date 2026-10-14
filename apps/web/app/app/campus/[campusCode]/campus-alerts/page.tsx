import { CampusAlertsOpsClient } from "../_components/CampusAlertsOpsClient";

export default async function CampusAlertsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  return <CampusAlertsOpsClient campusCode={campusCode} />;
}
