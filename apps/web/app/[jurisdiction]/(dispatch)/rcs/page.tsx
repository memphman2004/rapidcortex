import { redirect } from "next/navigation";
import { RcsMonitorPanel } from "@/components/rcs/RcsMonitorPanel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewRcsMonitor } from "@/lib/rcs/rcs-authz";
import { isRcsEnabled } from "@/lib/runtime-flags";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function RcsMonitorPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isRcsEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewRcsMonitor(user, user.agencyId)) redirect(`/${jurisdiction}/dashboard`);

  return <RcsMonitorPanel user={user} />;
}
