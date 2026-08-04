import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { JobPostingsManagement } from "@/components/rc-admin/hiring/job-postings-management";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isHiringUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Job Postings",
  robots: { index: false, follow: false },
};

export default async function RcAdminHiringPostingsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isHiringUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/hiring/postings`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Job postings</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Create, publish, and archive careers listings. Published roles appear on www.rapidcortex.us/careers.
        </p>
      </div>
      <JobPostingsManagement />
    </div>
  );
}
