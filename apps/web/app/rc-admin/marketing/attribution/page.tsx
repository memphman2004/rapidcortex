import { redirect } from "next/navigation";
import Link from "next/link";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Marketing Attribution",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MarketingAttributionPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/attribution`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Marketing Attribution</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pipeline revenue attributed to marketing activity by vertical, zone, campaign, and
          channel.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Available Now</h2>
        <p className="mb-3 text-sm text-slate-400">
          Channel mix, attributed pipeline totals, and referrer breakdown are live in{" "}
          <Link href="/rc-admin/marketing" className="text-sky-400 hover:underline">
            Marketing Overview
          </Link>{" "}
          today, filterable by product market and all six sales zones.
        </p>
        <Link
          href="/rc-admin/marketing"
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700/20 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-700/40"
        >
          Go to Marketing Overview →
        </Link>
      </div>

      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-slate-300">
          Full Attribution Reports — Phase 2
        </h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          Campaign ROI, first-touch vs multi-touch attribution, marketing-sourced contract value,
          and sales cycle by channel will appear here in Phase 2.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          Coming in Phase 2
        </div>
      </div>
    </div>
  );
}
