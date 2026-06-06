import { redirect } from "next/navigation";
import { canAccessRcUsagePortal } from "rapid-cortex-shared";
import { RcAdminUsageTab } from "@/components/rc-admin/usage-tab";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "API usage metering",
  robots: { index: false, follow: false },
};

export default async function RcAdminUsagePage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcUsagePortal(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/usage`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">API usage</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          RC Lite programmatic API call meters by customer and billing tier. Revenue columns are visible
          to platform owners only.
        </p>
      </div>
      <RcAdminUsageTab userRole={user.role} />
    </div>
  );
}
