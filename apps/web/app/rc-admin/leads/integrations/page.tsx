import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import { CrmIntegrationsPage } from "@/components/rc-admin/leads/crm-integrations-page";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "CRM integrations",
  robots: { index: false, follow: false },
};

export default async function LeadsIntegrationsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessSalesLeadsCrm(user.role) || !isSalesLeadsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/leads/integrations`);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/rc-admin/leads" className="text-sm text-slate-400 hover:text-white">
          Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Integrations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          A reply on a lead becomes a contact and a deal in the CRM your team already works in.
        </p>
      </div>
      <CrmIntegrationsPage />
    </div>
  );
}
