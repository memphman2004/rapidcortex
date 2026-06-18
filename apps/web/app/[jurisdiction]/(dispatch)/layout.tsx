import { DispatchShell } from "@/components/dispatch/dispatch-shell";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = {
  children: React.ReactNode;
  params: Promise<{ jurisdiction: string }>;
};

export default async function DispatchLayout({ children, params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);

  const user = await getDashboardSessionUser();
  return <DispatchShell user={user}>{children}</DispatchShell>;
}
