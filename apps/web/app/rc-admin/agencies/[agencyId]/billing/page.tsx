import { Suspense } from "react";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { AgencyBillingHubClient } from "@/components/billing/agency-billing-hub-client";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "Agency billing (RC Admin)",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencyBillingPage({ params }: Props) {
  const { agencyId } = await params;
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role)) {
    redirect(
      `${marketingLoginPath()}?from=/rc-admin/agencies/${encodeURIComponent(agencyId)}/billing`,
    );
  }

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading billing…</p>}>
      <AgencyBillingHubClient agencyId={agencyId} />
    </Suspense>
  );
}
