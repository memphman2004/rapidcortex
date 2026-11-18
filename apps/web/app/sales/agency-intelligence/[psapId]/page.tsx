import { redirect } from "next/navigation";
import { canAccessPsapProspectsCrm, canVerifyAgencyIntelligence } from "rapid-cortex-shared";
import { AgencyProfileClient } from "@/components/sales/agency-profile-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isPsapProspectsUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Agency Intelligence profile",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AgencyIntelligenceProfilePage({
  params,
}: {
  params: Promise<{ psapId: string }>;
}) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessPsapProspectsCrm(user.role) || !isPsapProspectsUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/sales/agency-intelligence`);
  }
  const { psapId } = await params;
  return <AgencyProfileClient psapId={psapId} canVerify={canVerifyAgencyIntelligence(user.role)} />;
}
