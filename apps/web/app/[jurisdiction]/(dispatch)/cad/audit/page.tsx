import { redirect } from "next/navigation";
import { CadAuditLog } from "@/components/cad-connector/cad-audit-log";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canViewCadAudit } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function CadConnectorAuditPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewCadAudit(user, user.agencyId)) redirect(`/${jurisdiction}/cad/incidents`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadAuditLog />
    </CadShell>
  );
}
