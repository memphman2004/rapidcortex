import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { MarketingOverviewClient } from "@/components/marketing/marketing-overview-client";

export const metadata = {
  title: "Marketing Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MarketingDashboardPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing`);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-1 px-3 py-4 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Marketing Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Are we generating qualified interest and pipeline? Filter by product market, sales zone,
          and more.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <MarketingOverviewClient />
      </Suspense>
    </div>
  );
}
