import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { LeadIntelligenceClient } from "@/components/marketing/lead-intelligence-client";

export const metadata = {
  title: "Lead Intelligence",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LeadIntelligencePage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/leads`);
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-1 px-3 py-4 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Lead Intelligence</h1>
        <p className="mt-1 text-sm text-slate-400">
          Agency-level interest cards showing lead score, buying signals, recent activity, and
          confirmed next actions. Sourced from the shared CRM — no double entry.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading leads…</p>}>
        <LeadIntelligenceClient />
      </Suspense>
    </div>
  );
}
