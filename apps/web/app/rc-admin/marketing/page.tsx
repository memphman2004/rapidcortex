import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { MarketingOverviewClient } from "@/components/marketing/marketing-overview-client";
import { SeoMetricsPanel } from "@/components/marketing/seo-metrics-panel";

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
    <div className="mx-auto max-w-[1600px] space-y-6 px-3 py-4 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">Marketing Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Are we generating qualified interest and pipeline? Filter by product market, sales zone,
          and more.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-slate-400">Loading overview…</p>}>
        <MarketingOverviewClient />
      </Suspense>

      {/* ── Google Search Visibility ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Google Search Visibility</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              90-day impressions, clicks, average position, and top queries from Google Search
              Console — plus GA4 sessions and lead events.
            </p>
          </div>
          <Link
            href="/rc-admin/marketing/website"
            className="shrink-0 rounded-md border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white"
          >
            Full SEO report →
          </Link>
        </div>
        <Suspense fallback={<p className="text-sm text-slate-400">Syncing Search Console…</p>}>
          <SeoMetricsPanel />
        </Suspense>
      </section>
    </div>
  );
}
