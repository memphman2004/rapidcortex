import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { SignalFeedClient } from "@/components/rc-admin/leads/signal-feed-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Signal Feed",
  robots: { index: false, follow: false },
};

export default async function RcAdminSignalFeedPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isSalesLeadsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/signal-feed`);
  }
  return <SignalFeedClient />;
}
