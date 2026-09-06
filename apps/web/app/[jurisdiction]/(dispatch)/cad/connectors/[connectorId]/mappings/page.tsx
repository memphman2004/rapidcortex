import { redirect } from "next/navigation";
import { CadFieldMappingEditor } from "@/components/cad-connector/cad-field-mapping-editor";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canManageCadConnectors } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string; connectorId: string }> };

export default async function CadConnectorMappingsPage({ params }: Props) {
  const { jurisdiction, connectorId } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canManageCadConnectors(user, user.agencyId)) redirect(`/${jurisdiction}/cad/incidents`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadFieldMappingEditor connectorId={connectorId} />
    </CadShell>
  );
}
