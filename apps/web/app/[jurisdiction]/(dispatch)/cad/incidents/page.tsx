import { redirect } from "next/navigation";
import { CadIncidentFeed } from "@/components/cad-connector/cad-incident-feed";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canViewCadIncidents } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function CadConnectorIncidentsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewCadIncidents(user, user.agencyId)) redirect(`/${jurisdiction}/dashboard`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadIncidentFeed user={user} jurisdiction={jurisdiction} />
    </CadShell>
  );
}
