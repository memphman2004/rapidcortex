import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { CampaignManagerHub } from "@/components/marketing/campaign-manager-hub";

export const metadata = {
  title: "Campaign Manager",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CampaignManagerPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/campaigns`);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-1 px-3 py-4 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Campaign Manager</h1>
        <p className="mt-1 text-sm text-slate-400">
          SES email campaigns, Apollo sequences, email list, and NexCortiQ Signal newsletter — all
          from one place.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading campaigns…</p>}>
        <CampaignManagerHub />
      </Suspense>
    </div>
  );
}
