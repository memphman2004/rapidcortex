import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesAutomationUiEnabled } from "@/lib/runtime-flags";
import { OutlookCallbackClient } from "./outlook-callback-client";

export const metadata = {
  title: "Connect Outlook",
  robots: { index: false, follow: false },
};

export default async function OutlookCallbackPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isSalesAutomationUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/sales-automation`);
  }

  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Connecting hello@rapidcortex.us…</p>}>
      <OutlookCallbackClient />
    </Suspense>
  );
}
