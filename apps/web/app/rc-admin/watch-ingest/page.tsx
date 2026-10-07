import { redirect } from "next/navigation";
import { canAccessRapidIqWorkspace } from "rapid-cortex-shared";
import { WatchIngestAdminClient } from "@/components/rapid-iq/watch-ingest-admin-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isRapidIqPipelineUiEnabled, isRapidIqUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Watch Ingest Tester",
  robots: { index: false, follow: false },
};

export default async function WatchIngestAdminPage() {
  const user = await getDashboardSessionUser();
  if (
    !user ||
    !canAccessRapidIqWorkspace(user.role) ||
    !isRapidIqUiEnabled() ||
    !isRapidIqPipelineUiEnabled()
  ) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/watch-ingest`);
  }
  return <WatchIngestAdminClient />;
}
