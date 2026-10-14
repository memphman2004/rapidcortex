import { EscortIqOpsClient } from "../_components/EscortIqOpsClient";

export default async function CampusEscortIqPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  return <EscortIqOpsClient campusCode={campusCode} />;
}
