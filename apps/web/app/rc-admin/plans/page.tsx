import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { marketingLoginPath } from "@/lib/marketing-links";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "Platform plans catalog",
  robots: { index: false, follow: false },
};

export default async function RcAdminPlansPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role))
    redirect(`${marketingLoginPath()}?from=/rc-admin/plans`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Plans (Dynamo + catalog SKUs)</h1>
      <p className="max-w-3xl text-sm text-slate-400">
        Dashboard plans (`essential`, `command`, `enterprise_statewide`) stay separate from `rc_lite` API-only rows. Internal
        catalog SKUs live in <code className="rounded bg-slate-900 px-1 text-xs text-sky-200">packages/shared</code> (
        <code className="rounded bg-slate-900 px-1 text-xs text-sky-200">SUBSCRIPTION_PLANS</code>) for procurement alignment;
        align internal plan SKUs and external references in Dynamo per environment.
      </p>
      <Link href="/rc-admin/billing" className="text-sm text-sky-400 hover:text-sky-300">
        ← Back to billing hub
      </Link>
    </div>
  );
}
