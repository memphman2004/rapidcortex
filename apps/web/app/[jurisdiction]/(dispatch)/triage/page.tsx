import { redirect } from "next/navigation";
import { dispatchDashboardHref } from "@/lib/dispatch-workspace-links";
import { blockPsapRoutesForVerticalAgency } from "@/lib/venue/venue-psap-route-guard";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function TriagePage({ params }: Props) {
  const { jurisdiction } = await params;
  await blockPsapRoutesForVerticalAgency(jurisdiction);
  redirect(dispatchDashboardHref(jurisdiction, { queue: "non_emergency" }));
}
