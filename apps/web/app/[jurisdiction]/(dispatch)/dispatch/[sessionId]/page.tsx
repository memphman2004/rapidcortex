import { redirect } from "next/navigation";
import { dispatchDashboardHref } from "@/lib/dispatch-workspace-links";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string; sessionId: string }> };

/** Legacy deep links — unified live console is on /dispatcher?incident=. */
export default async function DispatchSessionRedirectPage({ params }: Props) {
  const { jurisdiction, sessionId } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);
  redirect(dispatchDashboardHref(jurisdiction, { incidentId: sessionId }));
}
