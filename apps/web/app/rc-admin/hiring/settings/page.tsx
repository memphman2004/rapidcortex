import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { HiringBookingsSettings } from "@/components/rc-admin/hiring/hiring-bookings-settings";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isHiringUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Hiring settings",
  robots: { index: false, follow: false },
};

export default async function RcAdminHiringSettingsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isHiringUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/hiring/settings`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Hiring settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Microsoft Bookings URLs for phone screens and interviews. Status-move emails auto-fill these
          scheduling links.
        </p>
      </div>
      <HiringBookingsSettings />
    </div>
  );
}
