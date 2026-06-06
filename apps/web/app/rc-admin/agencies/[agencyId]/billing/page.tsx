import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Billing — {agencyId}</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Manage invoicing, entitlement records, and reconciliation for this tenant through RC Admin tooling and the tenant
        billing HTTP reads. RC Lite vs dashboard lines must not be mixed on the same contract without explicit hybrid
        procurement language.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/rc-admin/billing" className="text-sky-400 hover:text-sky-300">
          ← Billing hub
        </Link>
        <Link
          href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`}
          className="text-sky-400 hover:text-sky-300"
        >
          Feature add-ons →
        </Link>
        <Link
          href={`/rc-admin/agencies/${encodeURIComponent(agencyId)}/network`}
          className="text-sky-400 hover:text-sky-300"
        >
          Network access →
        </Link>
      </div>
    </div>
  );
}
