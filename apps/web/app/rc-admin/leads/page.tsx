import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { LeadsCrmPage } from "@/components/rc-admin/leads/leads-crm-page";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Leads CRM",
  robots: { index: false, follow: false },
};

export default async function RcAdminLeadsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isSalesLeadsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/leads`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leads CRM</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Pipeline board for Contact Sales, Ring™ Waitlist, and Inside iQ leads. Drag cards
            between stages, edit CRM fields inline, and track activity.
          </p>
        </div>
        <Link
          href="/rc-admin/leads/integrations"
          className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
        >
          Integrations
        </Link>
      </div>
      <LeadsCrmPage />
    </div>
  );
}
