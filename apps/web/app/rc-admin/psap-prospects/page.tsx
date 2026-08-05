import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";
import { PsapProspectsClient } from "./psap-prospects-client";

export const metadata = {
  title: "PSAP Prospects",
  robots: { index: false, follow: false },
};

export default async function RcAdminPsapProspectsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isPsapProspectsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/psap-prospects`);
  }

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500">Loading PSAP Prospects…</div>
      }
    >
      <PsapProspectsClient />
    </Suspense>
  );
}
