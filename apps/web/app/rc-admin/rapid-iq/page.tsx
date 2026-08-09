import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { RapidIqClient } from "@/components/rapid-iq/rapid-iq-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isRapidIqUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Rapid IQ",
  robots: { index: false, follow: false },
};

export default async function RcAdminRapidIqPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isRapidIqUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/rapid-iq`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Rapid IQ</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          AI-powered sales intelligence for 911, campus, and venue procurement signals. Review
          opportunities, source documents, contact matches, and convert high-fit signals to Leads CRM.
        </p>
      </div>
      <RapidIqClient />
    </div>
  );
}
