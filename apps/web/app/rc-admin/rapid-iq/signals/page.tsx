import { redirect } from "next/navigation";
import { canAccessRapidIq } from "rapid-cortex-shared";
import { PipelineSignalsClient } from "@/components/rapid-iq/pipeline/pipeline-signals-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isRapidIqPipelineUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Rapid IQ Signals",
  robots: { index: false, follow: false },
};

export default async function RcAdminRapidIqSignalsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessRapidIq(user.role) || !isRapidIqPipelineUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/rapid-iq/signals`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Rapid IQ Signals</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Automated procurement signal detection from USASpending, SAM.gov, news, and board
          minutes. Score fit and push qualified leads into CRM.
        </p>
      </div>
      <PipelineSignalsClient />
    </div>
  );
}
