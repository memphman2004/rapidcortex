import { redirect } from "next/navigation";
import { CadShell } from "@/components/cad-connector/cad-shell";
import { CadWriteBackQueue } from "@/components/cad-connector/cad-writeback-queue";
import { canViewCadIncidents } from "@/lib/cad-connector/cad-authz";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isCadConnectorEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function CadWriteBackPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isCadConnectorEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewCadIncidents(user, user.agencyId)) redirect(`/${jurisdiction}/dashboard`);
  return (
    <CadShell user={user} jurisdiction={jurisdiction}>
      <CadWriteBackQueue user={user} />
    </CadShell>
  );
}
