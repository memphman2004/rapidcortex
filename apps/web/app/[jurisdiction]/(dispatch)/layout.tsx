import { DispatchShell } from "@/components/dispatch/dispatch-shell";
import { AIGateProvider } from "@/lib/ai-gate";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAiFeatureGateEnabled } from "@/lib/runtime-flags";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = {
  children: React.ReactNode;
  params: Promise<{ jurisdiction: string }>;
};

export default async function DispatchLayout({ children, params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  const user = await getDashboardSessionUser();
  const body = <DispatchShell user={user}>{children}</DispatchShell>;

  if (!isAiFeatureGateEnabled() || !user?.agencyId) {
    return body;
  }

  return (
    <AIGateProvider agencyId={user.agencyId}>{body}</AIGateProvider>
  );
}
