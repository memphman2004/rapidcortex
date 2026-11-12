import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Website & SEO",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WebsiteSeoPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/website`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Website & SEO</h1>
        <p className="mt-1 text-sm text-slate-400">
          Website performance, organic search visibility, and lead source attribution from
          rapidcortex.us.
        </p>
      </div>

      {/* CRM-derived web attribution (available now) */}
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">CRM-Derived Web Attribution</h2>
        <p className="text-sm text-slate-400">
          Lead source channel breakdown is available in{" "}
          <a href="/rc-admin/marketing" className="text-sky-400 hover:underline">
            Marketing Overview
          </a>{" "}
          today — channels like <em>organic_search</em>, <em>linkedin</em>, <em>referral</em>, and{" "}
          <em>direct</em> are derived from UTM params and referrer URLs on every inbound lead.
        </p>
      </div>

      {/* Phase 2 placeholder */}
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
          <span className="text-2xl">🌐</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-slate-300">
          GA4 & Search Console — Phase 2
        </h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          Google Analytics 4 visitors, traffic sources, pages viewed, and engagement data will
          appear here once the GA4 Data API and Search Console integration are connected.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          Coming in Phase 2
        </div>
      </div>
    </div>
  );
}
