import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Social Media & Content",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SocialContentPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/social`);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3 py-4 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Social Media & Content</h1>
        <p className="mt-1 text-sm text-slate-400">
          LinkedIn posts, content performance, and audience engagement tracking.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05]">
          <span className="text-2xl">📢</span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-slate-300">Social & Content — Phase 2</h3>
        <p className="mx-auto max-w-md text-sm text-slate-500">
          LinkedIn post performance, campaign post attribution, and content engagement metrics will
          appear here once the LinkedIn Marketing API is connected.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
          Coming in Phase 2
        </div>
      </div>
    </div>
  );
}
