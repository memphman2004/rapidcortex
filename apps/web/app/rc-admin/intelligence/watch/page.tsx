import { redirect } from "next/navigation";
import { canAccessRapidIqWorkspace } from "rapid-cortex-shared";
import { WatchInboxClient } from "@/components/rapid-iq/watch-inbox-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isRapidIqPipelineUiEnabled, isRapidIqUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Watch Inbox",
  robots: { index: false, follow: false },
};

export default async function WatchInboxPage() {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    !canAccessRapidIqWorkspace(user.role) ||
    !isRapidIqUiEnabled() ||
    !isRapidIqPipelineUiEnabled()
  ) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/intelligence/watch`);
  }

  return <WatchInboxClient />;
}
