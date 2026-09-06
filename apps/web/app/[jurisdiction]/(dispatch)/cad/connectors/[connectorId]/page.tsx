import { redirect } from "next/navigation";
import { CadConnectorManager } from "@/components/cad-connector/cad-connector-manager";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canManageCadConnectors } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string; connectorId: string }> };

export default async function CadConnectorDetailPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canManageCadConnectors(user, user.agencyId)) redirect(`/${jurisdiction}/cad/incidents`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadConnectorManager user={user} jurisdiction={jurisdiction} />
    </CadShell>
  );
}
