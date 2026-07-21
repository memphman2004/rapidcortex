import { redirect } from "next/navigation";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { canViewRcsMonitor } from "@/lib/rcs/rcs-authz";
import { isRcsEnabled } from "@/lib/runtime-flags";
import { RcsTriggerDemoClient } from "./trigger-demo-client";

/**
 * Sandbox page for reviewing RCS component states without a live call bound in the
 * dispatcher workspace. Real integration point (once the workspace exposes a bound
 * `RcsCall` for the selected incident):
 *
 * TODO(rcs): mount `<RcsSilentMonitorTrigger call={...} user={user} />` inline in the
 * "Top action bar" of `apps/web/components/dispatch/cad-dispatcher-workspace-layout.tsx`
 * (search for `RCS Monitor` — a link to `/rcs` is already wired there behind the
 * `rcs` feature flag / `canViewRcsMonitor`). Swap that link for the live trigger once
 * `rcsStartCall` / `rcsListActiveCalls` can resolve the call bound to the workspace's
 * currently selected incident.
 */

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function RcsTriggerDemoPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);
  if (!isRcsEnabled()) redirect(`/${jurisdiction}/dashboard`);
  if (!canViewRcsMonitor(user, user.agencyId)) redirect(`/${jurisdiction}/dashboard`);

  return <RcsTriggerDemoClient user={user} />;
}
