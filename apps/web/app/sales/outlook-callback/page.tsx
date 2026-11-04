import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessSalesTools } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesToolsUiEnabled } from "@/lib/runtime-flags";
import { SalesOutlookCallbackClient } from "./outlook-callback-client";

export const metadata = {
  title: "Connect Outlook",
  robots: { index: false, follow: false },
};

export default async function SalesOutlookCallbackPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesTools(user.role) || !isSalesToolsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/sales`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Suspense fallback={<p className="text-sm text-slate-400">Connecting Outlook…</p>}>
        <SalesOutlookCallbackClient />
      </Suspense>
    </div>
  );
}
