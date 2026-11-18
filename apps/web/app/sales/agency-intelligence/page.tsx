import { redirect } from "next/navigation";
import { canAccessPsapProspectsCrm } from "rapid-cortex-shared";
import { AgencyIntelligenceClient } from "@/components/sales/agency-intelligence-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Agency Intelligence",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AgencyIntelligencePage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessPsapProspectsCrm(user.role) || !isPsapProspectsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/sales/agency-intelligence`);
  }

  return <AgencyIntelligenceClient />;
}
