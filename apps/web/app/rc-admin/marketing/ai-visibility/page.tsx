import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isMarketingDashboardEnabled } from "@/lib/runtime-flags";
import { AiVisibilityClient } from "@/components/marketing/ai-visibility/ai-visibility-client";

export const metadata = {
  title: "AI Visibility",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AiVisibilityPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isMarketingDashboardEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/marketing/ai-visibility`);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-3 py-4 md:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-white">AI Search Visibility</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track whether NexCort iQ appears when buyers research 911 technology and public safety
          software through ChatGPT, Claude, Gemini, Perplexity, and other AI search experiences.
        </p>
      </div>
      <AiVisibilityClient />
    </div>
  );
}
