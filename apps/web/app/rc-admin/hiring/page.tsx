import { redirect } from "next/navigation";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ApplicantsCrmPage } from "@/components/rc-admin/hiring/applicants-crm-page";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isHiringUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Hiring ATS",
  robots: { index: false, follow: false },
};

export default async function RcAdminHiringPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRcFinancePortal(user.role) || !isHiringUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/hiring`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Hiring</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Applicant tracking for careers.rapidcortex applications. Move candidates through New →
          Reviewing → Phone Screen → Interview → Offer, with optional automated emails.
        </p>
      </div>
      <ApplicantsCrmPage />
    </div>
  );
}
