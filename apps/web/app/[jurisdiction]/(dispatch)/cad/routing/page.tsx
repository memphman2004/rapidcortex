import { redirect } from "next/navigation";
import { CadRoutingBuilder } from "@/components/cad-connector/cad-routing-builder";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { canManageCadRouting } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function CadRoutingPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canManageCadRouting(user, user.agencyId)) redirect(`/${jurisdiction}/cad/incidents`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadRoutingBuilder />
    </CadShell>
  );
}
