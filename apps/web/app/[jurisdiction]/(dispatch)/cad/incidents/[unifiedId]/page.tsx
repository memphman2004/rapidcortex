import { redirect } from "next/navigation";
import { CadIncidentDetail } from "@/components/cad-connector/cad-incident-detail";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canViewCadIncidents } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string; unifiedId: string }> };

export default async function CadConnectorIncidentDetailPage({ params }: Props) {
  const { jurisdiction, unifiedId } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewCadIncidents(user, user.agencyId)) redirect(`/${jurisdiction}/dashboard`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadIncidentDetail user={user} unifiedId={unifiedId} />
    </CadShell>
  );
}
